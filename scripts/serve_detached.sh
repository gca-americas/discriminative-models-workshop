#!/usr/bin/env bash
# Start the workbench fully detached from the calling terminal, so it survives
# the terminal (or an agent session) closing. Logs go to runs/workbench.log.
cd "$(dirname "$0")/.."
mkdir -p runs
PORT="${JEV101_PORT:-4900}"
# Rehearsal mode (setup chose it, or fell back to it)? Start the stand-in.
# DiffusionGemma on a VM? Open the private tunnel to it.
if grep -q '^JEV101_REHEARSAL=1' .env 2>/dev/null; then
  scripts/rehearsal.sh start || true
elif grep -q '^JEV101_GEMMA_VM=' .env 2>/dev/null && grep -q '^TYPESAFE_BASE_URL=http://127.0.0.1:' .env 2>/dev/null; then
  scripts/gemma_tunnel.sh start || true
fi
( JEV101_PORT="$PORT" nohup .venv/bin/python serve.py >> runs/workbench.log 2>&1 < /dev/null & ) &
sleep 3
curl -s -m 3 -o /dev/null -w "workbench on $PORT → %{http_code}\n" "localhost:$PORT/api/env"
