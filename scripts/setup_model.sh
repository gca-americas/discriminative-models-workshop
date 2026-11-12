#!/usr/bin/env bash
# Choose the decision model the workshop uses, check that it works, and point
# the workshop at it. Run after ./setup_codelab.sh. Safe to run again, to switch.
#
#   Jev               TypeSafe's hosted model. Needs a TypeSafe API key; the key
#                     is checked with one real request before it is kept.
#   DiffusionGemma    Google's open model, on a GPU VM in your own project.
#                     Needs billing and GPU quota; the quota is checked first.
#   Gemini Decisions  Google's hosted model, gemini-decision-1. Needs a Gemini
#                     API key; the key is checked with one real request.
#
# Every choice also needs a Gemini API key: step 6 reads the spell card with
# Gemini Decisions and writes the tale with Gemini.
#
#   scripts/setup_model.sh                          asks
#   scripts/setup_model.sh --model jev              the key comes from TYPESAFE_API_KEY or .env
#   scripts/setup_model.sh --model gemma -- --warm  options after -- go to setup_gemma.sh
#   scripts/setup_model.sh --model gemini           the key comes from GEMINI_API_KEY or .env
#   scripts/setup_model.sh --model jev --no-fallback   exit 1 if it fails, rather than
#                                                      offering the other models
#
# The workbench runs it from step 2 with --model and --no-fallback.
set -euo pipefail
cd "$(dirname "$0")/.."

MODEL=""
YES=0
FALLBACK=1
GEMMA_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --model)
      [ $# -ge 2 ] || { echo "--model needs a value: jev, gemma or gemini"; exit 2; }
      MODEL="$2"; shift 2 ;;
    --yes|-y) YES=1; shift ;;
    --no-fallback) FALLBACK=0; shift ;;
    --) shift; GEMMA_ARGS=("$@"); break ;;
    -h|--help) sed -n 2,22p "$0"; exit 0 ;;
    *) GEMMA_ARGS+=("$1"); shift ;;               # e.g. --warm, --region, passed through
  esac
done

INTERACTIVE=1
{ [ "$YES" = 1 ] || [ ! -t 0 ]; } && INTERACTIVE=0
[ -f .env ] || cp .env.example .env
[ -x .venv/bin/python ] || { echo "Run ./setup_codelab.sh first."; exit 1; }
mkdir -p runs

ask() {             # ask "question" default → echoes the answer
  local answer=""
  if [ "$INTERACTIVE" = 1 ]; then read -r -p "$1 " answer; fi
  echo "${answer:-$2}"
}
ask_secret() {      # never echoed, never logged
  local answer=""
  if [ "$INTERACTIVE" = 1 ]; then read -r -s -p "$1 " answer; echo >&2; fi
  echo "$answer"
}
set_env() {         # set_env KEY VALUE: replace or add one line in .env
  touch .env
  grep -v "^$1=" .env > .env.tmp || true
  if [ -n "$2" ]; then echo "$1=$2" >> .env.tmp; fi
  mv .env.tmp .env
}
get_env() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- || true; }

# ── the Gemini API key ─────────────────────────────────────────────────────
# Needed whatever the choice: Gemini Decisions reads the spell card in step 6,
# and Gemini writes the tale. Checked with one real request before it is kept.
GEMINI_OK=""                  # "", yes or no: checked once per run
gemini_key() {
  [ -n "$GEMINI_OK" ] && { [ "$GEMINI_OK" = yes ]; return; }
  local key
  key="${GEMINI_API_KEY:-}"                       # the workbench passes a new key this way
  key="${key:-$(get_env GEMINI_API_KEY)}"
  if [ -z "$key" ] && [ "$INTERACTIVE" = 1 ]; then
    echo
    echo "The workshop needs a Gemini API key. Create one here:"
    echo "  https://aistudio.google.com/apikey"
    echo
    key="$(ask_secret 'Paste your GEMINI_API_KEY:')"
  fi
  if [ -z "$key" ]; then
    echo "· no Gemini API key"
    GEMINI_OK=no; return 1
  fi
  echo "· checking the Gemini API key with one request to gemini-decision-1"
  if GEMINI_API_KEY="$key" .venv/bin/python scripts/verify_gemini_key.py < /dev/null; then
    set_env GEMINI_API_KEY "$key"
    # The workshop reaches Gemini with this key only. Vertex AI settings from
    # an earlier setup would send Gemini calls there instead.
    set_env GOOGLE_GENAI_USE_VERTEXAI ""
    set_env GOOGLE_API_KEY ""
    # The Gemini model that writes the tale in step 6: one this key can call.
    local tale
    if tale="$(GEMINI_API_KEY="$key" .venv/bin/python scripts/pick_gemini_model.py 2>/dev/null < /dev/null)" && [ -n "$tale" ]; then
      set_env JEV101_GEMINI_MODEL "$tale"
    fi
    GEMINI_OK=yes; return 0
  fi
  GEMINI_OK=no; return 1
}

# ── which decision model ───────────────────────────────────────────────────
# Each option is checked before it is kept. A key is tried with a real
# request; DiffusionGemma needs GPU quota. If an option fails, the others are
# offered.

TRIED=""                      # options that were tried and failed
tried() { case " $TRIED " in *" $1 "*) return 0 ;; esac; return 1; }

try_jev() {
  local key
  local source="the key you entered"
  key="${TYPESAFE_API_KEY:-}"                     # the workbench passes a new key this way
  case "$key" in self-hosted) key="" ;; esac
  if [ -z "$key" ]; then
    key="$(get_env TYPESAFE_API_KEY)"
    source="the TYPESAFE_API_KEY already in .env (no key was entered)"
  fi
  case "$key" in self-hosted) key="" ;; esac
  if [ -z "$key" ] && [ "$INTERACTIVE" = 1 ]; then
    echo
    echo "Jev needs an API key from TypeSafe. Sign in and create one here:"
    echo "  https://console.typesafe.ai/login?returnTo=%2Fkeys"
    echo
    key="$(ask_secret 'Paste your TYPESAFE_API_KEY:')"
    source="the key you entered"
  fi
  if [ -z "$key" ]; then
    echo "· no Jev key was entered, and .env has none"
    return 1
  fi
  echo "· checking $source with one request to api.typesafe.ai"
  if TYPESAFE_API_KEY="$key" .venv/bin/python scripts/verify_jev_key.py < /dev/null; then
    set_env TYPESAFE_API_KEY "$key"
    set_env TYPESAFE_BASE_URL ""                  # api.typesafe.ai
    set_env JEV101_MODEL jev
    return 0
  fi
  return 1
}

# A VM this workshop set up before, still in the project: switching back to
# DiffusionGemma only has to start it again, not set it up.
gemma_vm_exists() {
  local vm zone vm_project
  vm="$(get_env JEV101_GEMMA_VM)"; zone="$(get_env JEV101_GEMMA_ZONE)"; vm_project="$(get_env JEV101_GEMMA_PROJECT)"
  [ -n "$vm" ] && [ -n "$zone" ] && gcloud compute instances describe "$vm" --zone "$zone" \
      ${vm_project:+--project "$vm_project"} --format='value(status)' >/dev/null 2>&1 < /dev/null
}

try_gemma() {
  if ! command -v gcloud >/dev/null 2>&1; then
    echo "· DiffusionGemma needs the gcloud CLI: https://cloud.google.com/sdk/docs/install"
    return 1
  fi
  if gemma_vm_exists; then
    echo "· starting the DiffusionGemma VM you set up before, $(get_env JEV101_GEMMA_VM): about 2 minutes"
    scripts/gemma_warm.sh on < /dev/null > runs/gemma-warm.log 2>&1 || { echo "  could not start it (runs/gemma-warm.log)"; return 1; }
    # The model takes a few minutes to load after the VM starts.
    local ready=0
    for _ in $(seq 1 60); do
      scripts/gemma_tunnel.sh start >/dev/null 2>&1 < /dev/null || true
      if curl -s -m 8 "http://127.0.0.1:${JEV101_GEMMA_PORT:-8096}/health" 2>/dev/null | grep -q '"ok"'; then
        ready=1; break
      fi
      sleep 10
    done
    [ "$ready" = 1 ] || {
      echo "· the VM started, but the model did not answer within 10 minutes. Choose DiffusionGemma again"
      echo "  in a few minutes, or look at the VM: sudo tail -50 /var/log/djev-startup.log"
      return 1
    }
    echo "  the model is answering"
    set_env TYPESAFE_BASE_URL "http://127.0.0.1:${JEV101_GEMMA_PORT:-8096}"
    set_env JEV101_MODEL gemma
    return 0
  fi
  local project
  project="$(gcloud config get-value project 2>/dev/null || true)"
  echo
  echo "DiffusionGemma runs on a GPU VM in your own Google Cloud project."
  echo "  project:  ${project:-(none, run: gcloud config set project YOUR_PROJECT)}"
  echo "  needs:    billing, and Compute Engine quota for a GPU"
  echo "  cost:     Google Cloud's GPU pricing while the VM runs; stop it after with scripts/gemma_warm.sh off"
  [ -n "$project" ] || return 1
  echo "· checking the GPU quota"
  if ! scripts/setup_gemma.sh --check-quota ${GEMMA_ARGS[@]+"${GEMMA_ARGS[@]}"}; then
    echo "· not enough GPU quota for DiffusionGemma"
    return 1
  fi
  scripts/setup_gemma.sh --skip-quota-check ${GEMMA_ARGS[@]+"${GEMMA_ARGS[@]}"} || return 1
  set_env JEV101_MODEL gemma
  return 0
}

try_gemini() {
  gemini_key || return 1
  set_env JEV101_MODEL gemini
  set_env TYPESAFE_BASE_URL ""                    # no Jev-compatible server in use
  return 0
}

pick() {            # the menu, without the options that already failed → echoes a choice
  local n=0 line default=1
  local -a keys=()
  echo >&2
  echo "Which decision model should the workshop use?" >&2
  echo >&2
  if ! tried jev; then
    n=$((n + 1)); keys+=(jev)
    echo "  $n) Jev (TypeSafe)     Hosted by TypeSafe. Needs a TypeSafe API key. No GPU needed." >&2
  fi
  if ! tried gemma; then
    n=$((n + 1)); keys+=(gemma)
    echo "  $n) DiffusionGemma     Google's open model on a GPU VM in your project." >&2
    echo "                        Needs billing and GPU quota. About 15 minutes the first time." >&2
  fi
  if ! tried gemini; then
    n=$((n + 1)); keys+=(gemini); default=$n      # needs the least, so it is the default
    echo "  $n) Gemini Decisions   Hosted by Google. Needs a Gemini API key. No GPU needed." >&2
  fi
  line="$(ask "Choose 1-$n [$default]:" "$default")"
  case "$line" in
    ''|*[!0-9]*) line=$default ;;
  esac
  [ "$line" -ge 1 ] && [ "$line" -le "${#keys[@]}" ] || line=$default
  echo "${keys[$((line - 1))]}"
}

# What the workshop used before this run, so a switch can clean up after it.
WAS_GEMMA=0
case "$(get_env TYPESAFE_BASE_URL)" in
  http://127.0.0.1:"${JEV101_GEMMA_PORT:-8096}"*) [ -n "$(get_env JEV101_GEMMA_VM)" ] && WAS_GEMMA=1 ;;
esac

# The Gemini API key comes first: every choice needs it, for step 6.
gemini_key || true

CHOICE="$MODEL"
while true; do
  if [ -z "$CHOICE" ]; then
    if [ "$INTERACTIVE" = 1 ]; then CHOICE="$(pick)"; else CHOICE="gemini"; fi
  fi
  case "$CHOICE" in
    jev)
      if try_jev; then MODEL=jev; break; fi
      TRIED="$TRIED jev"
      echo "· Jev did not work."
      ;;
    gemma|diffusiongemma)
      if try_gemma; then MODEL=gemma; break; fi
      TRIED="$TRIED gemma"
      echo "· DiffusionGemma is not available here."
      ;;
    gemini|gemini-decisions)
      if try_gemini; then MODEL=gemini; break; fi
      TRIED="$TRIED gemini"
      echo "· Gemini Decisions did not work."
      ;;
    *) echo "unknown model: $CHOICE (jev, gemma or gemini)"; exit 2 ;;
  esac
  [ "$FALLBACK" = 1 ] || exit 1
  if tried jev && tried gemma && tried gemini; then
    echo
    echo "None of the three models is available here. Check the key you used and run this again."
    exit 1
  fi
  if [ "$INTERACTIVE" = 0 ]; then
    # Nobody to ask: Gemini Decisions needs the least, so it is tried next.
    if tried gemini; then exit 1; fi
    echo "· trying Gemini Decisions instead."
    CHOICE="gemini"
  else
    CHOICE=""
  fi
done

# Step 6 needs the Gemini API key whichever model was chosen.
if [ "$MODEL" != gemini ] && ! gemini_key; then
  echo "· the decision model is set, but there is no working Gemini API key yet."
  echo "  Step 6 needs one to read the spell card and write the tale. Create it at"
  echo "  https://aistudio.google.com/apikey and run this again."
fi

# ── after a switch ─────────────────────────────────────────────────────────
# Leaving DiffusionGemma: stop its VM, so the GPU is not billed while unused.
# Choosing it again starts the same VM (see try_gemma).
if [ "$WAS_GEMMA" = 1 ] && [ "$MODEL" != gemma ]; then
  echo "· stopping the DiffusionGemma VM, $(get_env JEV101_GEMMA_VM): you no longer use it, and a stopped VM costs only its disk"
  if scripts/gemma_warm.sh off < /dev/null > runs/gemma-warm.log 2>&1; then
    echo "  stopped"
  else
    echo "  could not stop it (runs/gemma-warm.log); run scripts/gemma_warm.sh off"
  fi
fi

# The arena app reads the model settings when it starts, so a running one would
# keep the old model. Restart it.
WORKBENCH="http://127.0.0.1:${JEV101_PORT:-4900}"
if curl -s -m 3 "$WORKBENCH/api/app/status" 2>/dev/null | grep -q '"running": *true'; then
  if curl -s -m 15 -X POST "$WORKBENCH/api/app/stop" -H 'Content-Type: application/json' -d '{}' >/dev/null 2>&1 \
     && curl -s -m 30 -X POST "$WORKBENCH/api/app/start" -H 'Content-Type: application/json' -d '{}' >/dev/null 2>&1; then
    echo "· restarted the arena app, so it uses the new model"
  else
    echo "· stopped the arena app, so it picks up the new model: start it again in the step you are on"
  fi
fi

echo
.venv/bin/python scripts/check_setup.py || true
