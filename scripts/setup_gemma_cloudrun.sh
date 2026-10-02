#!/usr/bin/env bash
# ALTERNATIVE, for projects with Cloud Run RTX PRO 6000 quota. The default is
# scripts/setup_gemma.sh, which uses a Compute Engine VM with one L4 instead.
#
# Put DiffusionGemma on Cloud Run as a Discriminative-model-compatible endpoint, and point this
# workshop at it. Run once, before the workshop. Safe to run again: every step
# checks what already exists.
#
#   scripts/setup_gemma.sh                     your current gcloud project, us-central1
#   scripts/setup_gemma.sh --warm              keep one GPU running (no 48 s cold start)
#   scripts/setup_gemma.sh --invoker group:students@example.com
#                                              let others call it (shared, instructor-run)
#   scripts/setup_gemma.sh --public            anyone with the URL can call it (careful: a GPU)
#   scripts/setup_gemma.sh --dry-run           print every command, run nothing
#   scripts/setup_gemma.sh --check-quota       only check GPU quota; exit 0 if there is some
#
# Options: --project ID  --region REGION  --service NAME  --bucket NAME
#
# Hugging Face: set HF_TOKEN in the environment to download with your account
# (faster, not rate-limited, works if the model is ever gated). Optional today.
#
# GPU: one NVIDIA RTX PRO 6000. Tested 2026-09-23: the djev-run image does NOT
# start on Cloud Run's L4 (CUDA error 803: its CUDA 13 needs a newer driver
# than the L4 hosts have), so there is no smaller GPU to fall back to.
#
# What it does, in order:
#   1. enables Cloud Run, Cloud Storage and IAM
#   2. makes a bucket for the weights, and lets the service's identity use it
#   3. stages the weights (17.5 GB, nvidia/diffusiongemma-26B-A4B-it-NVFP4) into
#      the bucket with a one-off Cloud Run job, so nothing large crosses your
#      own network
#   4. deploys github.com/taeold/djev-run on one NVIDIA RTX PRO 6000 GPU
#   5. waits for it, sends one real question, and writes its URL into .env
#
# Cost: about $3.19 an hour while an instance runs; $0 when it has scaled to
# zero. --warm keeps one running until you run scripts/gemma_warm.sh off, or
# scripts/teardown_gemma.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
REGION="us-central1"
SERVICE="djev-dgemma"
JOB="djev-weights"
BUCKET=""
WEIGHTS="nvidia/diffusiongemma-26B-A4B-it-NVFP4"
IMAGE="ghcr.io/taeold/djev-run:latest"
GPU="rtx-pro-6000"
WARM=0
PUBLIC=0
INVOKERS=()
DRY=0
CHECK_ONLY=0
SKIP_QUOTA=0

while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --service) SERVICE="$2"; shift 2 ;;
    --bucket) BUCKET="$2"; shift 2 ;;
    --gpu) GPU="$2"; shift 2 ;;
    --warm) WARM=1; shift ;;
    --public) PUBLIC=1; shift ;;
    --invoker) INVOKERS+=("$2"); shift 2 ;;
    --dry-run) DRY=1; shift ;;
    --check-quota) CHECK_ONLY=1; shift ;;
    --skip-quota-check) SKIP_QUOTA=1; shift ;;
    -h|--help) sed -n 2,30p "$0"; exit 0 ;;
    *) echo "unknown option: $1 (try --help)"; exit 2 ;;
  esac
done

# Per-GPU settings. The L4 has 24 GB: vLLM gets 92% of it, the weights are
# not copied into RAM first, and the instance tops out at 8 vCPU / 32 GiB.
case "$GPU" in
  rtx-pro-6000)
    GPU_TYPE="nvidia-rtx-pro-6000"; QUOTA_ID="NvidiaRtxPro6000GpuAllocNoZonalRedundancyPerProjectRegion"
    SHAPE=(--cpu 20 --memory 80Gi --concurrency 32)
    TUNING="CANVAS=128,MAX_SEQS=32,GPU_UTIL=0.40,COPY_TO_SHM=1,VLLM_FLASHINFER_MOE_BACKEND=masked_gemm"
    PRICE='$3.19'
    case "$REGION" in
      us-central1|europe-west4|asia-southeast1|asia-south2) ;;
      *) echo "RTX PRO 6000 GPUs on Cloud Run are in us-central1, europe-west4, asia-southeast1, asia-south2."; exit 2 ;;
    esac ;;
  l4)
    echo "The djev-run image does not start on Cloud Run L4 GPUs (CUDA error 803:"
    echo "the image needs a newer NVIDIA driver than the L4 hosts have). Use rtx-pro-6000."
    exit 2 ;;
  *) echo "--gpu must be rtx-pro-6000"; exit 2 ;;
esac
[ -n "$PROJECT" ] || { echo "No project. Run: gcloud config set project YOUR_PROJECT (or pass --project)"; exit 2; }
BUCKET="${BUCKET:-${PROJECT}-djev-weights}"

say()  { printf '\n· %s\n' "$*"; }
run()  { if [ "$DRY" = 1 ]; then printf '  $ %s\n' "$*"; else "$@"; fi; }

# ── 0. GPU quota ───────────────────────────────────────────────────────────
# Cloud Run GPUs need quota, and most projects start with none. Asking first
# saves twenty minutes of staging weights for a service that cannot start.
gpu_quota() {
  gcloud services enable cloudquotas.googleapis.com --project "$PROJECT" --quiet >/dev/null 2>&1 || true
  gcloud beta quotas info describe "$QUOTA_ID" \
    --service run.googleapis.com --project "$PROJECT" --format json 2>/dev/null \
  | python3 -c '
import json, sys
region = sys.argv[1]
try:
    info = json.load(sys.stdin)
except ValueError:
    print("unknown"); sys.exit()
for dim in info.get("dimensionsInfos", []):
    if region in dim.get("applicableLocations", []) or dim.get("dimensions", {}).get("region") == region:
        print(dim.get("details", {}).get("value", 0))   # an absent value is zero
        sys.exit()
print(0)' "$REGION"
}

QUOTA_URL="https://console.cloud.google.com/iam-admin/quotas?project=$PROJECT"
if [ "$SKIP_QUOTA" = 0 ]; then
  QUOTA="$(gpu_quota)"
  if [ "$QUOTA" = "unknown" ]; then
    echo "· could not read the Cloud Run GPU quota for $PROJECT; carrying on (the deploy will say if there is none)"
  elif [ "$QUOTA" -lt 1 ] 2>/dev/null; then
    echo "· $PROJECT has no Cloud Run GPU quota for $GPU in $REGION (quota: $QUOTA)."
    echo "  DiffusionGemma needs one GPU. Request it, then run this again:"
    echo "    $QUOTA_URL"
    echo "    (search for $QUOTA_ID, region $REGION)"
    echo "  Or use the Discriminative model on TypeSafe instead:  scripts/setup_model.sh --model jev"
    exit 3
  else
    echo "· Cloud Run GPU quota in $REGION: $QUOTA × $GPU"
  fi
fi
[ "$CHECK_ONLY" = 1 ] && exit 0

say "project $PROJECT · region $REGION · service $SERVICE · bucket gs://$BUCKET"
[ "$DRY" = 1 ] && echo "  (dry run: nothing below is executed)"

# ── 1. APIs ────────────────────────────────────────────────────────────────
say "enabling Cloud Run, Cloud Storage and IAM"
run gcloud services enable run.googleapis.com storage.googleapis.com iam.googleapis.com \
  --project "$PROJECT"

NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
RUNTIME_SA="${NUMBER}-compute@developer.gserviceaccount.com"

# ── 2. bucket ──────────────────────────────────────────────────────────────
if gcloud storage buckets describe "gs://$BUCKET" --project "$PROJECT" >/dev/null 2>&1; then
  say "bucket gs://$BUCKET already exists"
else
  say "creating gs://$BUCKET"
  run gcloud storage buckets create "gs://$BUCKET" --project "$PROJECT" --location "$REGION" \
    --uniform-bucket-level-access
fi
say "letting the service's identity ($RUNTIME_SA) read and write the weights"
run gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
  --member "serviceAccount:$RUNTIME_SA" --role roles/storage.objectAdmin --format none --quiet

# ── 3. weights ─────────────────────────────────────────────────────────────
if gcloud storage ls "gs://$BUCKET/dgemma/config.json" >/dev/null 2>&1; then
  say "weights already staged in gs://$BUCKET/dgemma"
else
  say "staging the weights ($WEIGHTS, ~17.5 GB) with a Cloud Run job — about 10 minutes"
  # Downloaded to the job's in-memory disk, then copied into the mounted bucket.
  STAGE="pip install -q huggingface_hub hf_transfer && HF_HUB_ENABLE_HF_TRANSFER=1 python -c \"from huggingface_hub import snapshot_download; snapshot_download('$WEIGHTS', local_dir='/tmp/dgemma')\" && mkdir -p /mnt/gcs/dgemma && cp -r /tmp/dgemma/. /mnt/gcs/dgemma/ && ls -la /mnt/gcs/dgemma"
  run gcloud run jobs deploy "$JOB" --project "$PROJECT" --region "$REGION" \
    --image python:3.12-slim --cpu 8 --memory 32Gi --task-timeout 3600 --max-retries 1 \
    --add-volume "name=weights,type=cloud-storage,bucket=$BUCKET" \
    --add-volume-mount "volume=weights,mount-path=/mnt/gcs" \
    --command bash --args "^@@^-c@@$STAGE" --quiet
  # A Hugging Face token, if given, goes to this one execution only: it is not
  # saved in the job's configuration, and never printed.
  if [ -n "${HF_TOKEN:-}" ]; then
    if [ "$DRY" = 1 ]; then
      echo "  \$ gcloud run jobs execute $JOB --project $PROJECT --region $REGION --wait --update-env-vars HF_TOKEN=hf_…(hidden)"
    else
      gcloud run jobs execute "$JOB" --project "$PROJECT" --region "$REGION" --wait \
        --update-env-vars "HF_TOKEN=$HF_TOKEN"
    fi
  else
    run gcloud run jobs execute "$JOB" --project "$PROJECT" --region "$REGION" --wait
  fi
fi

# ── 4. the model service ───────────────────────────────────────────────────
MIN=0; [ "$WARM" = 1 ] && MIN=1
AUTH=(--no-allow-unauthenticated); [ "$PUBLIC" = 1 ] && AUTH=(--allow-unauthenticated)
say "deploying $SERVICE on one $GPU (min instances $MIN)"
run gcloud beta run deploy "$SERVICE" --project "$PROJECT" --region "$REGION" \
  --image "$IMAGE" \
  --gpu 1 --gpu-type "$GPU_TYPE" --no-gpu-zonal-redundancy \
  "${SHAPE[@]}" --no-cpu-throttling \
  --min-instances "$MIN" --max-instances 1 --port 8080 --timeout 300 \
  --add-volume "name=weights,type=cloud-storage,bucket=$BUCKET,readonly=false,mount-options=enable-buffered-read=true" \
  --add-volume-mount "volume=weights,mount-path=/mnt/gcs" \
  --startup-probe "httpGet.path=/health,httpGet.port=8080,initialDelaySeconds=10,periodSeconds=5,timeoutSeconds=3,failureThreshold=190" \
  --set-env-vars "MODEL=/mnt/gcs/dgemma,MAX_MODEL_LEN=4096,KV_CACHE_GB=2,ATTN=TRITON_ATTN,TEST_PAGE=1,ENFORCE_EAGER=1,DISABLE_MM=1,TORCH_COMPILE_DISABLE=1,VLLM_WORKER_MULTIPROC_METHOD=fork,VLLM_UF_EAGER_ALL=1,CUDA_MODULE_LOADING=LAZY,$TUNING" \
  "${AUTH[@]}" --quiet

for who in ${INVOKERS[@]+"${INVOKERS[@]}"}; do
  say "letting $who call it"
  run gcloud run services add-iam-policy-binding "$SERVICE" --project "$PROJECT" --region "$REGION" \
    --member "$who" --role roles/run.invoker --format none --quiet
done

if [ "$DRY" = 1 ]; then
  URL="https://$SERVICE-<hash>.$REGION.run.app"
else
  URL="$(gcloud run services describe "$SERVICE" --project "$PROJECT" --region "$REGION" --format 'value(status.url)')"
fi

# ── 5. check it, and point the workshop at it ──────────────────────────────
if [ "$DRY" = 0 ]; then
  say "waiting for $URL to answer (a cold start takes about a minute)"
  TOKEN="$(gcloud auth print-identity-token)"
  for i in $(seq 1 60); do
    code="$(curl -s -o /dev/null -w '%{http_code}' -m 20 -H "Authorization: Bearer $TOKEN" "$URL/health" || true)"
    [ "$code" = 200 ] && break
    sleep 5
  done
  [ "$code" = 200 ] || { echo "  it did not answer /health (last status $code). Logs: gcloud run services logs read $SERVICE --region $REGION"; exit 1; }
  say "asking it one real question"
  curl -s -m 60 -X POST "$URL/v1/systemone" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d '{"model":"jev-latest","state":{"telegraph":"The ogre staggers, off balance, its guard wide open."},"questions":{"exposed":{"type":"noul","instructions":"Is the opponent exposed to a counter-attack right now?"}}}'
  echo
fi

say "pointing this workshop at it (.env)"
if [ "$DRY" = 1 ]; then
  echo "  TYPESAFE_BASE_URL=$URL"
else
  touch .env
  grep -v '^TYPESAFE_BASE_URL=\|^JEV101_JEV_AUTH=' .env > .env.tmp || true
  { cat .env.tmp; echo "TYPESAFE_BASE_URL=$URL"; [ "$PUBLIC" = 1 ] && echo "JEV101_JEV_AUTH=none"; } > .env
  rm -f .env.tmp
fi

cat <<EOF

Done. The workshop now uses DiffusionGemma on Cloud Run:
  $URL
Check it:            python3 scripts/check_setup.py
Keep it warm:        scripts/gemma_warm.sh on     (\$3.19/h until 'off')
Let it sleep:        scripts/gemma_warm.sh off
Remove it:           scripts/teardown_gemma.sh
EOF
