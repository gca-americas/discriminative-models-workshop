#!/usr/bin/env bash
# Development: API on 4900, Vite with hot reload on 5274.
set -euo pipefail

cd "$(dirname "$0")/.."
JEV101_LOG_LEVEL=warning .venv/bin/python serve.py --reload &
API=$!
trap 'kill $API 2>/dev/null || true' EXIT
cd web && npm run dev
