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

# Rehearsal mode (setup chose it, or fell back to it)? Start the stand-in.
# DiffusionGemma on a VM? Open the private tunnel to it.
if grep -q '^JEV101_REHEARSAL=1' .env 2>/dev/null; then
  scripts/rehearsal.sh start || true
elif grep -q '^JEV101_GEMMA_VM=' .env 2>/dev/null && grep -q '^TYPESAFE_BASE_URL=http://127.0.0.1:' .env 2>/dev/null; then
  scripts/gemma_tunnel.sh start || true
fi

echo
echo "  Getting started with Discriminative (Jev/DiffusionGemma) models"
echo "  http://localhost:${PORT}"
if [ "${JEV101_REHEARSAL:-}" != "" ] || grep -q '^JEV101_REHEARSAL=1' .env 2>/dev/null; then
  echo "  rehearsal mode: Discriminative model calls go to scripts/fake_jev.py, not to TypeSafe"
fi
echo
JEV101_PORT="$PORT" JEV101_LOG_LEVEL=warning exec .venv/bin/python serve.py
