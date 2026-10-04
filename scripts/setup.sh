#!/usr/bin/env bash
# Set up the Getting started with Discriminative (Jev/DiffusionGemma) models workbench on this machine, before the workshop.
#
# It installs the workbench, enables the Google Cloud APIs the workshop uses
# (Compute Engine, IAP and Vertex AI), and sets up Gemini for step 6's spell
# reading, with a Gemini model the project can call. The decision model is
# chosen separately, in step 2 of the workbench or with scripts/setup_model.sh.
#
#   scripts/setup.sh            asks
#   scripts/setup.sh --yes      accept the defaults, never prompt
#
# Then: scripts/start.sh   →  http://localhost:4900
set -euo pipefail
cd "$(dirname "$0")/.."

YES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) YES=1; shift ;;
    -h|--help) sed -n 2,13p "$0"; exit 0 ;;
    *) echo "unknown option: $1 (try --help)"; exit 2 ;;
  esac
done

INTERACTIVE=1
{ [ "$YES" = 1 ] || [ ! -t 0 ]; } && INTERACTIVE=0

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

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1 — $2"; exit 1; }; }
need uv "https://docs.astral.sh/uv/getting-started/installation/"
need node "https://nodejs.org (20 or newer)"
need npm "comes with node"

# ── the workbench itself ───────────────────────────────────────────────────
echo "· Python dependencies (typesafe-sdk, google-adk, fastapi)"
uv sync --quiet < /dev/null          # never let an installer eat the answers typed below
echo "· building the page"
(cd web && npm install --silent < /dev/null && npm run build --silent >/dev/null < /dev/null)
[ -f .env ] || cp .env.example .env

# ── Google Cloud APIs ──────────────────────────────────────────────────────
# Compute Engine and IAP for DiffusionGemma on a GPU VM, Vertex AI for Gemini.
# Enabled now, so choosing a model in step 2 does not wait on them.
PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [ -z "$PROJECT" ]; then
  echo "· no Google Cloud project set, so no APIs enabled (gcloud config set project YOUR_PROJECT)"
else
  echo "· enabling Compute Engine, IAP and Vertex AI in $PROJECT"
  gcloud services enable compute.googleapis.com iap.googleapis.com aiplatform.googleapis.com \
      --project "$PROJECT" < /dev/null \
    || echo "  could not enable them. Check billing and your permissions on $PROJECT."
fi

# ── Gemini, for step 6's spell reading ─────────────────────────────────────
if [ -z "$(get_env GOOGLE_API_KEY)" ] && [ -z "$(get_env GOOGLE_GENAI_USE_VERTEXAI)" ]; then
  if [ -n "$PROJECT" ] && [ "$(ask "Use Gemini on Vertex AI in $PROJECT? [Y/n]:" y)" != "n" ]; then
    set_env GOOGLE_GENAI_USE_VERTEXAI 1
    set_env GOOGLE_CLOUD_PROJECT "$PROJECT"
    set_env GOOGLE_CLOUD_LOCATION global
  else
    echo "Gemini needs an AI Studio key for step 6: https://aistudio.google.com/apikey"
    KEY="$(ask_secret 'Paste your GOOGLE_API_KEY (Enter to add it to .env later):')"
    [ -n "$KEY" ] && set_env GOOGLE_API_KEY "$KEY"
  fi
fi

# A Gemini model name this project can call. The "-latest" alias is not in every
# Vertex AI project, so try the configured model and fall back to the newest
# Flash model the project lists. Saved as JEV101_GEMINI_MODEL, which the arena
# workflow and the step 6 branches read.
if [ -n "$(get_env GOOGLE_API_KEY)" ] || [ -n "$(get_env GOOGLE_GENAI_USE_VERTEXAI)" ]; then
  echo "· checking which Gemini model this project can call"
  if GEMINI_NAME="$(.venv/bin/python scripts/pick_gemini_model.py < /dev/null)"; then
    set_env JEV101_GEMINI_MODEL "$GEMINI_NAME"
    echo "  using $GEMINI_NAME"
  else
    echo "  no Gemini model answered; step 6 needs one. Run python3 scripts/pick_gemini_model.py later."
  fi
fi

echo
.venv/bin/python scripts/check_setup.py || true
echo
echo "Ready. Start the workbench:  scripts/start.sh   →  http://localhost:4900"
echo "Then choose the decision model in step 2."
