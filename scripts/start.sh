#!/usr/bin/env bash
# Start the workbench. Foreground: Ctrl+C stops it.
set -euo pipefail

cd "$(dirname "$0")/.."
PORT="${JEV101_PORT:-4900}"

if [ ! -d .venv ]; then
  echo "· creating the virtual environment"
  uv venv --quiet
fi
uv sync --quiet

if [ ! -d web/dist ]; then
  echo "· building the page"
  (cd web && npm install --silent && npm run build)
fi

# DiffusionGemma on a VM? Open the private tunnel to it.
if grep -q '^JEV101_GEMMA_VM=' .env 2>/dev/null && grep -q '^TYPESAFE_BASE_URL=http://127.0.0.1:' .env 2>/dev/null; then
  scripts/gemma_tunnel.sh start || true
fi

echo
echo "  Getting started with Discriminative models (Jev/Gemini Decisions)"
echo "  http://localhost:${PORT}"
echo
JEV101_PORT="$PORT" JEV101_LOG_LEVEL=warning exec .venv/bin/python serve.py
