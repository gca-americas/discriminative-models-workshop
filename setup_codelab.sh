#!/usr/bin/env bash
# Discriminative models workshop — one-shot environment setup. Safe to re-run:
# every step checks what is already there and keeps what you chose before.
#
# Run ./setup_project.sh FIRST: this script reads the project it recorded in
# ~/project_id.txt. When it finishes you have:
#   • uv, a .venv, and exactly what uv.lock pins inside it
#   • the APIs DiffusionGemma needs, enabled on that project
#   • a .env ready for the keys step 2 collects; a Gemini API key already in
#     it is checked with one real request
#   • the exercise files in the state students receive, on a first setup only
#   • the workbench built and running in the background on port 4900
#
# It asks nothing. The decision model (Jev, DiffusionGemma, or Gemini
# Decisions) and the Gemini API key are set in step 2 of the workbench, not here.
[ -n "${BASH_VERSION:-}" ] || exec bash "$0" "$@"
set -euo pipefail
cd "$(dirname "$0")"

PORT="${JEV101_PORT:-4900}"
say()  { printf '\n\033[1m%s\033[0m\n' "$1"; }
tick() { printf '  ✓ %s\n' "$1"; }
info() { printf '  · %s\n' "$1"; }
warn() { printf '  ! %s\n' "$1" >&2; }
die() {
    printf '\n\033[1m✗ %s\033[0m\n\n' "$1" >&2
    shift
    for line in "$@"; do printf '%s\n' "$line" >&2; done
    printf '\n' >&2
    exit 1
}

say "Discriminative models workshop · setup"

# ── 1 · python env + deps (uv owns both), and node for the page ─────────────
UV_WAS_INSTALLED=0
if ! command -v uv >/dev/null 2>&1; then
    info "uv not found — installing it from astral.sh"
    curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1 || die \
        "Could not install uv." \
        "Install it by hand, then re-run ./setup_codelab.sh:" \
        "  curl -LsSf https://astral.sh/uv/install.sh | sh" \
        "  source ~/.local/bin/env"
    if [ -f "$HOME/.local/bin/env" ]; then
        set +u
        # shellcheck disable=SC1091
        . "$HOME/.local/bin/env"
        set -u
    fi
    export PATH="$HOME/.local/bin:$PATH"
    UV_WAS_INSTALLED=1
fi
command -v uv >/dev/null 2>&1 || die \
    "uv installed but is not on PATH." \
    "Put it there, then re-run ./setup_codelab.sh:" \
    "  source ~/.local/bin/env"
tick "uv $(uv --version 2>/dev/null | awk '{print $2}')"

[ -d .venv ] || uv venv >/dev/null
# A corporate package index on a machine that is not on that network refuses
# every download. PyPI has everything this lab needs, so try it there next.
uv_sync() {
    if uv sync --quiet "$@" < /dev/null; then return 0; fi
    echo "  the configured package index did not answer; trying PyPI directly"
    env -u UV_INDEX_URL -u UV_EXTRA_INDEX_URL -u UV_INDEX -u PIP_INDEX_URL -u PIP_EXTRA_INDEX_URL \
        UV_DEFAULT_INDEX=https://pypi.org/simple uv sync --quiet "$@" < /dev/null
}
uv_sync
[ -x .venv/bin/python ] || die \
    "uv sync finished but .venv/bin/python is missing." \
    "Clear the env and let uv rebuild it:" \
    "  rm -rf .venv && ./setup_codelab.sh"
tick ".venv in sync with uv.lock (typesafe-sdk $(.venv/bin/python -c 'import importlib.metadata as m;print(m.version("typesafe-sdk"))' 2>/dev/null || echo pinned), google-genai $(.venv/bin/python -c 'import importlib.metadata as m;print(m.version("google-genai"))' 2>/dev/null || echo pinned), google-adk $(.venv/bin/python -c 'import google.adk;print(google.adk.__version__)' 2>/dev/null || echo pinned))"

command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 || die \
    "node and npm are needed to build the workbench page." \
    "Cloud Shell has them. On a laptop install Node 20 or newer, then re-run ./setup_codelab.sh."
tick "node $(node --version) · npm $(npm --version)"

# ── 2 · the project and the APIs this lab calls ─────────────────────────────
say "1 · Project and APIs"

PROJECT=""
PROJECT_FILE="$HOME/project_id.txt"
if [ -f "$PROJECT_FILE" ]; then
    PROJECT="$(tr -d '[:space:]' < "$PROJECT_FILE" || true)"
    [ -n "$PROJECT" ] && info "project: $PROJECT (from $PROJECT_FILE)"
fi
# No ~/project_id.txt: ./setup_project.sh was not run. Ask for an existing
# project, check that it exists and this account can see it, and record it so
# the next run reads it from the file like everyone else.
project_exists() {
    gcloud projects describe "$1" --format='value(projectId)' 2>/dev/null < /dev/null | grep -qx "$1"
}
if [ -z "$PROJECT" ] && [ -r /dev/tty ] && { : < /dev/tty; } 2>/dev/null; then
    DEFAULT="$(gcloud config get-value project 2>/dev/null < /dev/null || true)"
    echo "  No $PROJECT_FILE: ./setup_project.sh creates one. To use a project you already have, enter its ID."
    for _ in 1 2 3; do
        if [ -n "$DEFAULT" ]; then
            printf '  Project ID [%s]: ' "$DEFAULT"
        else
            printf '  Project ID: '
        fi
        read -r ANSWER < /dev/tty || ANSWER=""
        ANSWER="$(printf '%s' "${ANSWER:-$DEFAULT}" | tr -d '[:space:]')"
        [ -n "$ANSWER" ] || continue
        if project_exists "$ANSWER"; then
            PROJECT="$ANSWER"
            echo "$PROJECT" > "$PROJECT_FILE"
            tick "project: $PROJECT (saved to $PROJECT_FILE)"
            break
        fi
        warn "no project $ANSWER that this account can see. Check the ID (not the name) and try again."
    done
fi
if [ -z "$PROJECT" ]; then
    PROJECT="$(gcloud config get-value project 2>/dev/null < /dev/null || true)"
    [ -n "$PROJECT" ] && info "project: $PROJECT (from gcloud config)"
fi
[ -n "$PROJECT" ] || die \
    "No Google Cloud project to point at." \
    "This script reads the project ./setup_project.sh records. Run that first:" \
    "" \
    "  ./setup_project.sh" \
    "" \
    "Already have a project? Tell this lab about it and re-run:" \
    "  echo YOUR_PROJECT_ID > ~/project_id.txt" \
    "  gcloud config set project YOUR_PROJECT_ID"

gcloud config set project "$PROJECT" -q >/dev/null 2>&1 || true

# Enabling an API that is already on is a no-op, so this is safe to repeat.
enable_api() {
    local api="$1" what="$2"
    gcloud services enable "$api" --project="$PROJECT" -q 2>/dev/null < /dev/null || die \
        "Could not enable $api on $PROJECT." \
        "Usually billing is not on the project yet, or the project is seconds old" \
        "and its IAM policy is still propagating. Wait a minute, then re-run:" \
        "" \
        "  ./setup_project.sh    # confirms billing, waits for the project" \
        "  ./setup_codelab.sh"
    tick "$api  ($what)"
}
enable_api compute.googleapis.com "the GPU VM for DiffusionGemma, if you choose it in step 2"
enable_api iap.googleapis.com "the private tunnel to that VM"

# ── 3 · .env: ready for step 2; a Gemini API key already there is checked ───
say "2 · .env"

[ -f .env ] || cp .env.example .env
# Kept until the end of this step: if this run changes .env, the old one
# becomes .env.bak; if it changes nothing, the last .env.bak stays as it was.
cp .env .env.before
set_env() {         # set_env KEY VALUE: replace or add one line, keep the rest
    grep -v "^$1=" .env > .env.tmp || true
    printf '%s=%s\n' "$1" "$2" >> .env.tmp
    mv .env.tmp .env
}
unset_env() {       # unset_env KEY: remove its line
    grep -v "^$1=" .env > .env.tmp || true
    mv .env.tmp .env
}
# The lab reaches Gemini with an API key only (the Gemini Developer API).
# Vertex AI settings from an earlier version of this lab would send Gemini
# calls there instead, so they go (.env.bak still has them).
for key in GOOGLE_GENAI_USE_VERTEXAI GOOGLE_CLOUD_LOCATION GOOGLE_CLOUD_QUOTA_PROJECT; do
    if grep -q "^$key=" .env; then
        unset_env "$key"
        info "removed $key from .env: Gemini uses an API key now"
    fi
done
set_env GOOGLE_CLOUD_PROJECT "$PROJECT"
tick "project $PROJECT recorded, for DiffusionGemma if you choose it"
info "the decision model's settings in .env are left as they are; step 2 sets them"

# ── 4 · the Gemini API key, if one is already here ──────────────────────────
say "3 · Gemini API key"
# Step 2 asks for the key and checks it. A key already in .env is checked now,
# and the Gemini model for the tale in step 6 is picked with it.
if grep -q '^GEMINI_API_KEY=.' .env; then
    if .venv/bin/python scripts/verify_gemini_key.py < /dev/null; then
        tick "the Gemini API key in .env works"
        if GEMINI_NAME="$(.venv/bin/python scripts/pick_gemini_model.py < /dev/null)"; then
            set_env JEV101_GEMINI_MODEL "$GEMINI_NAME"
            tick "$GEMINI_NAME answered; saved as JEV101_GEMINI_MODEL"
        else
            warn "no Gemini Flash model answered with this key. The tale in step 6 needs one."
        fi
    else
        warn "the Gemini API key in .env did not work. Step 2 lets you enter another."
    fi
else
    info "no Gemini API key yet. Step 2 asks for one: https://aistudio.google.com/apikey"
fi
if cmp -s .env .env.before; then
    rm -f .env.before
    info ".env already up to date"
else
    mv .env.before .env.bak
    info "updated .env; the previous one is saved as .env.bak"
fi

# ── 5 · the state students receive ──────────────────────────────────────────
# The files students fill in ship in their TODO form, and a copy of each lives
# in starter/. A re-run never touches them: your work is kept. To put them back
# the way the workshop ships them, run scripts/starter.sh.
say "4 · Starting state"
placed=0
for f in scripts/first_call.py branches/read_card.py branches/fight_loop.py; do
    if [ ! -f "$f" ]; then
        mkdir -p "$(dirname "$f")" && cp "starter/$f" "$f"
        placed=$((placed + 1))
    fi
done
if [ "$placed" -gt 0 ]; then
    tick "$placed exercise file(s) put in place from starter/"
else
    info "exercise files are left as they are"
    info "to reset them to the state students receive:  scripts/starter.sh"
fi
# app/ starts in manual mode, the way step 3 expects it.
if [ ! -f runs/stage.json ]; then
    .venv/bin/python scripts/stage.py 3 >/dev/null 2>&1 < /dev/null || true
    tick "the arena app is in manual mode, ready for step 3"
fi

# ── 6 · the workbench: build the page, start the server in the background ───
say "5 · The workbench"
mkdir -p runs
(cd web && ([ -d node_modules ] || npm install --no-fund --no-audit >/dev/null 2>&1) && npm run build >/dev/null 2>&1) || die \
    "The page did not build." \
    "Run it by hand to see why:  cd web && npm install && npm run build"
tick "page built (web/dist)"

# Replace a workbench that is already running, rather than start a second one.
# Only what listens on this port is stopped, never another app's server.
if JEV101_PORT="$PORT" scripts/stop.sh >/dev/null 2>&1; then
    info "a workbench was running on $PORT; restarting it"
fi
JEV101_PORT="$PORT" scripts/serve_detached.sh >/dev/null 2>&1 < /dev/null || true
for _ in $(seq 1 60); do
    if curl -s -o /dev/null -m 2 "http://localhost:$PORT/api/env"; then break; fi
    sleep 1
done
if curl -s -o /dev/null -m 2 "http://localhost:$PORT/api/env"; then
    tick "workbench running in the background on http://localhost:$PORT  (log: runs/workbench.log)"
else
    die "The workbench did not answer on port $PORT within a minute." \
        "Read runs/workbench.log, then start it by hand:  scripts/start.sh"
fi

# ── 7 · preflight, run for you ──────────────────────────────────────────────
say "6 · Preflight"
.venv/bin/python scripts/check_setup.py < /dev/null || info "model: not ready is expected until you choose one in step 2"

# ── where to go next ────────────────────────────────────────────────────────
# Cloud Shell puts the preview host in WEB_HOST; elsewhere it is localhost.
if [ -n "${WEB_HOST:-}" ]; then
    LAB_URL="https://$PORT-$WEB_HOST"
else
    LAB_URL="http://localhost:$PORT"
fi

printf '\n\033[1m%s\033[0m\n' "Setup finished. The workbench is already running."
printf '\n'
printf '  \033[1mOpen this and start at step 0\033[0m\n'
printf '      %s/step/introduction\n\n' "$LAB_URL"
printf '  Step 2 chooses the decision model (Jev, DiffusionGemma, or Gemini Decisions)\n'
printf '  and takes your Gemini API key: https://aistudio.google.com/apikey\n\n'
printf '  It runs in the background. You do not need to start anything else.\n'
printf '      log      runs/workbench.log\n'
printf '      stop     scripts/stop.sh\n'
printf '      start    scripts/start.sh            in the foreground; Ctrl+C stops it\n\n'
printf '  Repeatable at any time:\n'
printf '      .venv/bin/python scripts/check_setup.py   re-check the environment\n'
printf '      ./setup_codelab.sh                        re-run this script; your files are kept\n'
printf '      scripts/starter.sh                        reset the exercise files\n\n'
[ "$UV_WAS_INSTALLED" -eq 1 ] && printf '  uv was just installed. Run this to get it in this shell:  source ~/.local/bin/env\n\n'
[ -n "${WEB_HOST:-}" ] || printf '  In Cloud Shell the link is also under Web Preview → Change port → %s.\n\n' "$PORT"
exit 0
