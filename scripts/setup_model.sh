#!/usr/bin/env bash
# Choose the decision model the workshop uses, check that it works, and point
# the workshop at it. Run after ./setup_codelab.sh. Safe to run again, to switch.
#
#   Jev             TypeSafe's hosted model. Needs a TypeSafe API key; the key
#                   is checked with one real request before it is kept.
#   DiffusionGemma  Google's open model, on a GPU VM in your own project.
#                   Needs billing and GPU quota; the quota is checked first.
#   Rehearsal       No model: a word list. Used automatically when neither of
#                   the others works.
#
#   scripts/setup_model.sh                          asks
#   scripts/setup_model.sh --model jev              the key comes from TYPESAFE_API_KEY or .env
#   scripts/setup_model.sh --model gemma -- --warm  options after -- go to setup_gemma.sh
#   scripts/setup_model.sh --model rehearsal
#   scripts/setup_model.sh --model jev --no-fallback   exit 1 if it fails, rather than
#                                                      falling back to rehearsal mode
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
    --model) MODEL="$2"; shift 2 ;;
    --yes|-y) YES=1; shift ;;
    --no-fallback) FALLBACK=0; shift ;;
    --) shift; GEMMA_ARGS=("$@"); break ;;
    -h|--help) sed -n 2,19p "$0"; exit 0 ;;
    *) GEMMA_ARGS+=("$1"); shift ;;               # e.g. --warm, --region, passed through
  esac
done

INTERACTIVE=1
{ [ "$YES" = 1 ] || [ ! -t 0 ]; } && INTERACTIVE=0
[ -f .env ] || cp .env.example .env
[ -x .venv/bin/python ] || { echo "Run ./setup_codelab.sh first."; exit 1; }

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

# ── which decision model ───────────────────────────────────────────────────
# Each option is checked before it is kept. A Jev key is tried with a real
# request; DiffusionGemma needs GPU quota. If an option fails, the others are
# offered. If Jev and DiffusionGemma both fail, the workshop falls back to
# rehearsal mode, which needs nothing.

TRIED=""                      # options that were tried and failed
tried() { case " $TRIED " in *" $1 "*) return 0 ;; esac; return 1; }

try_jev() {
  local key
  key="${TYPESAFE_API_KEY:-}"                     # the workbench passes a new key this way
  case "$key" in rehearsal|self-hosted) key="" ;; esac
  key="${key:-$(get_env TYPESAFE_API_KEY)}"
  if [ -z "$key" ] && [ "$INTERACTIVE" = 1 ]; then
    echo
    echo "Jev needs an API key from TypeSafe. Sign in and create one here:"
    echo "  https://console.typesafe.ai/login?returnTo=%2Fkeys"
    echo
    key="$(ask_secret 'Paste your TYPESAFE_API_KEY:')"
  fi
  if [ -z "$key" ]; then
    echo "· no Jev key"
    return 1
  fi
  echo "· checking the key with one request to api.typesafe.ai"
  if TYPESAFE_API_KEY="$key" .venv/bin/python scripts/verify_jev_key.py < /dev/null; then
    set_env TYPESAFE_API_KEY "$key"
    set_env TYPESAFE_BASE_URL ""                  # api.typesafe.ai
    set_env JEV101_REHEARSAL ""
    scripts/rehearsal.sh stop >/dev/null 2>&1 || true
    return 0
  fi
  return 1
}

try_gemma() {
  if ! command -v gcloud >/dev/null 2>&1; then
    echo "· DiffusionGemma needs the gcloud CLI: https://cloud.google.com/sdk/docs/install"
    return 1
  fi
  local project
  project="$(gcloud config get-value project 2>/dev/null || true)"
  echo
  echo "DiffusionGemma runs on a GPU VM in your own Google Cloud project."
  echo "  project:  ${project:-(none, run: gcloud config set project YOUR_PROJECT)}"
  echo "  needs:    billing, and Compute Engine quota for a GPU"
  echo "  cost:     Google Cloud's GPU pricing while the VM runs; stop it after with scripts/gemma_warm.sh off"
  [ -n "$project" ] || return 1
  if [ "$INTERACTIVE" = 1 ]; then
    case "$(ask 'Do you have GPU access in this project? [y/N]:' n)" in
      y|Y|yes) ;;
      *) return 1 ;;
    esac
  fi
  echo "· checking the GPU quota"
  if ! scripts/setup_gemma.sh --check-quota ${GEMMA_ARGS[@]+"${GEMMA_ARGS[@]}"}; then
    echo "· not enough GPU quota for DiffusionGemma"
    return 1
  fi
  scripts/setup_gemma.sh --skip-quota-check ${GEMMA_ARGS[@]+"${GEMMA_ARGS[@]}"} || return 1
  set_env JEV101_REHEARSAL ""
  scripts/rehearsal.sh stop >/dev/null 2>&1 || true
  return 0
}

use_rehearsal() {
  set_env JEV101_REHEARSAL 1
  set_env TYPESAFE_BASE_URL "http://127.0.0.1:${JEV101_FAKE_PORT:-4811}"
  echo "· rehearsal mode: a word list stands in for the model."
  echo "  Every step runs, but the model's answers are not real."
  scripts/rehearsal.sh start || true
}

pick() {            # the menu, without the options that already failed → echoes a choice
  local n=1 default="" line
  local -a keys=()
  echo >&2
  echo "Which decision model should the workshop use?" >&2
  echo >&2
  if ! tried jev; then
    echo "  $n) Jev (TypeSafe)     Hosted by TypeSafe. Needs a TypeSafe API key. No GPU needed." >&2
    keys+=(jev); n=$((n + 1))
  fi
  if ! tried gemma; then
    echo "  $n) DiffusionGemma     Google's open model on a GPU VM in your project." >&2
    echo "                        Needs billing and GPU quota. About 15 minutes the first time." >&2
    keys+=(gemma); n=$((n + 1))
  fi
  echo "  $n) Rehearsal          No model: a word list that speaks the same API." >&2
  echo "                        For trying the workshop out, not for teaching it." >&2
  keys+=(rehearsal)
  line="$(ask "Choose 1-$n [1]:" 1)"
  case "$line" in
    ''|*[!0-9]*) line=1 ;;
  esac
  [ "$line" -ge 1 ] && [ "$line" -le "${#keys[@]}" ] || line=1
  echo "${keys[$((line - 1))]}"
}

CHOICE="$MODEL"
while true; do
  if [ -z "$CHOICE" ]; then
    if [ "$INTERACTIVE" = 1 ]; then CHOICE="$(pick)"; else CHOICE="jev"; fi
  fi
  case "$CHOICE" in
    jev)
      if try_jev; then MODEL=jev; break; fi
      TRIED="$TRIED jev"
      echo "· Jev did not work."
      [ "$FALLBACK" = 1 ] || exit 1
      ;;
    gemma|diffusiongemma)
      if try_gemma; then MODEL=gemma; break; fi
      TRIED="$TRIED gemma"
      echo "· DiffusionGemma is not available here."
      [ "$FALLBACK" = 1 ] || exit 1
      ;;
    rehearsal)
      use_rehearsal; MODEL=rehearsal; break
      ;;
    *) echo "unknown model: $CHOICE (jev, gemma or rehearsal)"; exit 2 ;;
  esac
  if tried jev && tried gemma; then
    echo
    echo "Neither Jev nor DiffusionGemma is available, so the workshop will use rehearsal mode."
    use_rehearsal; MODEL=rehearsal; break
  fi
  if [ "$INTERACTIVE" = 0 ]; then
    echo "· nobody to ask, so the workshop will use rehearsal mode."
    use_rehearsal; MODEL=rehearsal; break
  fi
  CHOICE=""
done

echo
.venv/bin/python scripts/check_setup.py || true
