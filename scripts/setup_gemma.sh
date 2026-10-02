#!/usr/bin/env bash
# Put DiffusionGemma on one L4 GPU in your own Google Cloud project, as a
# Discriminative-model-compatible endpoint, and point this workshop at it. Run once, before the
# workshop. Safe to run again.
#
#   scripts/setup_gemma.sh                 current gcloud project, us-central1
#   scripts/setup_gemma.sh --check-quota   only check for L4 quota; exit 0 if there is some
#   scripts/setup_gemma.sh --dry-run       print every command, run nothing
#
# Options: --project ID  --region REGION  --name VM_NAME  --machine TYPE
#
# What it makes:
#   · one Compute Engine VM: g2-standard-4 (1 × NVIDIA L4 24 GB, 4 vCPU, 16 GB),
#     Google's Deep Learning image with NVIDIA driver 580, 100 GB disk
#   · on first boot the VM installs Docker, downloads the weights from Hugging
#     Face (nvidia/diffusiongemma-26B-A4B-it-NVFP4, 17.5 GB) and starts
#     djev-run (DiffusionGemma behind the Discriminative model's API): scripts/gemma_vm_startup.sh
#   · one firewall rule letting Google's IAP tunnel reach port 8080; nothing is
#     open to the internet
#
# The workbench reaches it through `gcloud compute start-iap-tunnel` on
# localhost:8096; scripts/start.sh opens that tunnel for you.
#
# Needs: billing, Compute Engine quota for 1 L4 in the region, and permission
# to create VMs and firewall rules (Owner or Editor on the project will do).
# Cost: about $0.71 an hour while the VM runs; stop it with
#   scripts/gemma_warm.sh off     (disk only, about $10 a month)
#   scripts/teardown_gemma.sh     (nothing)
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
REGION="us-central1"
NAME="djev-l4"
MACHINE="g2-standard-4"
IMAGE_FAMILY="common-cu129-ubuntu-2404-nvidia-580"
LOCAL_PORT="${JEV101_GEMMA_PORT:-8096}"
TAG="djev"
DRY=0
CHECK_ONLY=0
SKIP_QUOTA=0

while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJECT="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --name) NAME="$2"; shift 2 ;;
    --machine) MACHINE="$2"; shift 2 ;;
    --dry-run) DRY=1; shift ;;
    --check-quota) CHECK_ONLY=1; shift ;;
    --skip-quota-check) SKIP_QUOTA=1; shift ;;
    -h|--help) sed -n 2,31p "$0"; exit 0 ;;
    *) echo "unknown option: $1 (try --help)"; exit 2 ;;
  esac
done
[ -n "$PROJECT" ] || { echo "No project. Run: gcloud config set project YOUR_PROJECT (or pass --project)"; exit 2; }

say() { printf '\n· %s\n' "$*"; }
run() { if [ "$DRY" = 1 ]; then printf '  $ %s\n' "$*"; else "$@"; fi; }

# ── 0. quota: one L4 in the region, and GPUs at all ────────────────────────
l4_quota() {
  gcloud compute regions describe "$REGION" --project "$PROJECT" --format json 2>/dev/null | python3 -c '
import json, sys
try:
    quotas = json.load(sys.stdin)["quotas"]
except (ValueError, KeyError):
    print("unknown"); sys.exit()
q = {x["metric"]: x["limit"] - x.get("usage", 0) for x in quotas}
print(int(q.get("NVIDIA_L4_GPUS", 0)))'
}
all_regions_quota() {   # new projects often have GPUS_ALL_REGIONS = 0
  gcloud compute project-info describe --project "$PROJECT" --format json 2>/dev/null | python3 -c '
import json, sys
try:
    quotas = json.load(sys.stdin).get("quotas", [])
except ValueError:
    print("unknown"); sys.exit()
q = {x["metric"]: x["limit"] - x.get("usage", 0) for x in quotas}
print(int(q["GPUS_ALL_REGIONS"]) if "GPUS_ALL_REGIONS" in q else "none")'
}

if [ "$SKIP_QUOTA" = 0 ]; then
  run gcloud services enable compute.googleapis.com --project "$PROJECT"
  L4="$(l4_quota)"; ALL="$(all_regions_quota)"
  if [ "$L4" = unknown ]; then
    echo "· could not read Compute Engine quota for $PROJECT; carrying on"
  elif [ "$L4" -lt 1 ] || { [ "$ALL" != none ] && [ "$ALL" != unknown ] && [ "$ALL" -lt 1 ]; }; then
    echo "· $PROJECT cannot start an L4 in $REGION: L4 quota free $L4, all-regions GPU quota free $ALL."
    echo "  Request 1 of NVIDIA_L4_GPUS in $REGION (and GPUS_ALL_REGIONS if it is 0):"
    echo "    https://console.cloud.google.com/iam-admin/quotas?project=$PROJECT"
    echo "  Or use the Discriminative model on TypeSafe instead:  scripts/setup_model.sh --model jev"
    exit 3
  else
    echo "· L4 quota free in $REGION: $L4 (all-regions GPU quota free: $ALL)"
  fi
fi
[ "$CHECK_ONLY" = 1 ] && exit 0

say "project $PROJECT · region $REGION · VM $NAME ($MACHINE, 1 × L4)"
[ "$DRY" = 1 ] && echo "  (dry run: nothing below is executed)"

# ── 1. APIs and the firewall rule for IAP ──────────────────────────────────
say "enabling Compute Engine and IAP"
run gcloud services enable compute.googleapis.com iap.googleapis.com --project "$PROJECT"

if gcloud compute firewall-rules describe allow-iap-djev --project "$PROJECT" >/dev/null 2>&1; then
  say "firewall rule allow-iap-djev already exists"
else
  say "letting only Google's IAP tunnel reach the VM (ports 22 and 8080)"
  run gcloud compute firewall-rules create allow-iap-djev --project "$PROJECT" \
    --network default --direction INGRESS --action allow --rules tcp:22,tcp:8080 \
    --source-ranges 35.235.240.0/20 --target-tags "$TAG" --quiet
fi

# ── 2. the VM ──────────────────────────────────────────────────────────────
ZONE="$(gcloud compute instances list --project "$PROJECT" --filter "name=$NAME" --format 'value(zone.basename())' 2>/dev/null | head -1)"
if [ -n "$ZONE" ]; then
  say "$NAME already exists in $ZONE; making sure it is running"
  run gcloud compute instances add-metadata "$NAME" --zone "$ZONE" --project "$PROJECT" \
    --metadata-from-file startup-script=scripts/gemma_vm_startup.sh
  [ "$(gcloud compute instances describe "$NAME" --zone "$ZONE" --project "$PROJECT" --format 'value(status)')" = RUNNING ] \
    || run gcloud compute instances start "$NAME" --zone "$ZONE" --project "$PROJECT"
else
  # L4s run out zone by zone, so try each zone in the region that has them.
  ZONES="$(gcloud compute accelerator-types list --project "$PROJECT" --format 'value(name,zone.basename())' 2>/dev/null \
    | awk -v r="$REGION-" '$1 == "nvidia-l4" && index($2, r) == 1 {print $2}' | sort)"
  [ -n "$ZONES" ] || { echo "No L4s in $REGION. Try --region us-east1 or europe-west4."; exit 2; }
  for Z in $ZONES; do
    say "creating $NAME in $Z"
    if run gcloud compute instances create "$NAME" --project "$PROJECT" --zone "$Z" \
        --machine-type "$MACHINE" --accelerator type=nvidia-l4,count=1 \
        --maintenance-policy TERMINATE --provisioning-model STANDARD \
        --image-family "$IMAGE_FAMILY" --image-project deeplearning-platform-release \
        --boot-disk-size 100GB --boot-disk-type pd-balanced \
        --tags "$TAG" --labels purpose=jev-workshop \
        --metadata-from-file startup-script=scripts/gemma_vm_startup.sh; then
      ZONE="$Z"; break
    fi
    echo "  no luck in $Z; trying the next zone"
  done
  [ -n "$ZONE" ] || { echo "Could not create the VM in any $REGION zone (out of L4s, or quota)."; exit 1; }
fi

# ── 3. wait for the model ──────────────────────────────────────────────────
if [ "$DRY" = 0 ]; then
  say "waiting for DiffusionGemma to load: about 15 minutes the first time"
  echo "  (watch it: gcloud compute ssh $NAME --zone $ZONE --tunnel-through-iap -- sudo tail -f /var/log/djev-startup.log)"
  for i in $(seq 1 90); do
    state="$(gcloud compute ssh "$NAME" --zone "$ZONE" --project "$PROJECT" --tunnel-through-iap --quiet \
      --command 'curl -s -m 5 localhost:8080/health; echo; sudo tail -1 /var/log/djev-startup.log' 2>/dev/null || true)"
    echo "$state" | grep -q '"status": "ok"' && break
    printf '  %s  %s\n' "$(date +%H:%M:%S)" "$(echo "$state" | tail -1 | cut -c1-90)"
    sleep 20
  done
  echo "$state" | grep -q '"status": "ok"' || { echo "It did not come up. On the VM: sudo tail -50 /var/log/djev-startup.log"; exit 1; }
  echo "  ready"
fi

# ── 4. point the workshop at it ────────────────────────────────────────────
say "pointing this workshop at it (.env)"
if [ "$DRY" = 1 ]; then
  echo "  TYPESAFE_BASE_URL=http://127.0.0.1:$LOCAL_PORT"
  echo "  JEV101_GEMMA_VM=$NAME  JEV101_GEMMA_ZONE=<zone>  JEV101_GEMMA_PROJECT=$PROJECT"
else
  touch .env
  grep -vE '^(TYPESAFE_BASE_URL|JEV101_GEMMA_VM|JEV101_GEMMA_ZONE|JEV101_GEMMA_PROJECT|JEV101_JEV_AUTH)=' .env > .env.tmp || true
  { cat .env.tmp
    echo "TYPESAFE_BASE_URL=http://127.0.0.1:$LOCAL_PORT"
    echo "JEV101_GEMMA_VM=$NAME"
    echo "JEV101_GEMMA_ZONE=$ZONE"
    echo "JEV101_GEMMA_PROJECT=$PROJECT"; } > .env
  rm -f .env.tmp
  scripts/gemma_tunnel.sh start
  say "asking it one real question through the tunnel"
  curl -s -m 60 -X POST "http://127.0.0.1:$LOCAL_PORT/v1/systemone" -H 'Content-Type: application/json' \
    -d '{"model":"jev-latest","state":{"telegraph":"The ogre staggers, off balance, its guard wide open."},"questions":{"exposed":{"type":"noul","instructions":"Is the opponent exposed to a counter-attack right now?"}}}'
  echo
fi

cat <<EOF

Done. The workshop now uses DiffusionGemma on $NAME (1 × L4) in $PROJECT.
Check it:     python3 scripts/check_setup.py
Pause it:     scripts/gemma_warm.sh off    (stops the VM: no GPU charge)
Resume it:    scripts/gemma_warm.sh on     (about 2 minutes to load)
Remove it:    scripts/teardown_gemma.sh
EOF
