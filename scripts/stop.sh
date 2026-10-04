#!/usr/bin/env bash
# Stop the workbench: whatever listens on its port (4900, or JEV101_PORT), and
# nothing else. Exit 0 when something was stopped, 1 when nothing was running.
set -uo pipefail
PORT="${JEV101_PORT:-4900}"
PIDS="$(lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [ -z "$PIDS" ]; then
    echo "no workbench running on port $PORT"
    exit 1
fi
kill $PIDS 2>/dev/null || true
for _ in $(seq 1 20); do
    lsof -ti "tcp:$PORT" -sTCP:LISTEN >/dev/null 2>&1 || { echo "workbench on port $PORT stopped"; exit 0; }
    sleep 0.25
done
kill -9 $PIDS 2>/dev/null || true
echo "workbench on port $PORT stopped"
exit 0
