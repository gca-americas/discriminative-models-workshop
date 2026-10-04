#!/usr/bin/env bash
# Stop the workbench: whatever listens on its port (4900, or JEV101_PORT), and
# nothing else. Exit 0 when something was stopped, 1 when nothing was running,
# 2 when there is no tool here to look up the port.
set -uo pipefail
cd "$(dirname "$0")/.."

PORT="${JEV101_PORT:-$(grep -m1 '^JEV101_PORT=' .env 2>/dev/null | cut -d= -f2)}"
PORT="${PORT:-4900}"

# The process IDs listening on the port. Machines differ in what they have:
# macOS has lsof, Cloud Shell and other Debian images have ss, some only fuser.
listeners() {
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null
    elif command -v ss >/dev/null 2>&1; then
        ss -ltnpH "sport = :$PORT" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u
    elif command -v fuser >/dev/null 2>&1; then
        fuser -n tcp "$PORT" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$'
    else
        return 2
    fi
}

PIDS="$(listeners)"
if [ $? -eq 2 ]; then
    echo "cannot check port $PORT: none of lsof, ss or fuser is installed"
    exit 2
fi
if [ -z "$PIDS" ]; then
    echo "no workbench running on port $PORT"
    exit 1
fi
kill $PIDS 2>/dev/null || true
for _ in $(seq 1 20); do
    [ -z "$(listeners)" ] && { echo "workbench on port $PORT stopped"; exit 0; }
    sleep 0.25
done
kill -9 $PIDS 2>/dev/null || true
echo "workbench on port $PORT stopped"
exit 0
