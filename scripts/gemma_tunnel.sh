#!/usr/bin/env bash
# The private tunnel from this machine to the DiffusionGemma VM.
#
#   scripts/gemma_tunnel.sh start    open it (localhost:8096 → VM:8080), in the background
#   scripts/gemma_tunnel.sh stop     close it
#   scripts/gemma_tunnel.sh status   is it open, and does the model answer?
#
# Uses Google's IAP TCP forwarding: no port on the VM is open to the internet,
# and only people with IAP-secured Tunnel User on the project get through.
# Reads JEV101_GEMMA_VM / _ZONE / _PROJECT from .env (setup_gemma.sh writes them).
set -euo pipefail
cd "$(dirname "$0")/.."

env_get() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- || true; }
VM="$(env_get JEV101_GEMMA_VM)"; ZONE="$(env_get JEV101_GEMMA_ZONE)"; PROJECT="$(env_get JEV101_GEMMA_PROJECT)"
PORT="${JEV101_GEMMA_PORT:-8096}"
PIDFILE=runs/gemma-tunnel.pid
mkdir -p runs

answering() { curl -s -m 3 "http://127.0.0.1:$PORT/health" 2>/dev/null | grep -q '"ok"'; }
running() { [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }

case "${1:-status}" in
  start)
    [ -n "$VM" ] || { echo "no DiffusionGemma VM in .env (run scripts/setup_gemma.sh)"; exit 2; }
    if running && answering; then echo "tunnel already open: localhost:$PORT → $VM"; exit 0; fi
    running && kill "$(cat "$PIDFILE")" 2>/dev/null || true
    # Its own session, so it outlives the terminal that started it.
    ( nohup gcloud compute start-iap-tunnel "$VM" 8080 --local-host-port "localhost:$PORT" \
        --zone "$ZONE" --project "$PROJECT" > runs/gemma-tunnel.log 2>&1 < /dev/null &
      echo $! > "$PIDFILE" )
    for _ in $(seq 1 20); do answering && break; sleep 1; done
    if answering; then echo "tunnel open: localhost:$PORT → $VM ($ZONE)"
    else echo "tunnel started, but the model does not answer yet (is the VM running? scripts/gemma_warm.sh on)"; fi
    ;;
  stop)
    running && kill "$(cat "$PIDFILE")" && echo "tunnel closed" || echo "no tunnel open"
    rm -f "$PIDFILE"
    ;;
  status)
    if running; then echo -n "tunnel open (pid $(cat "$PIDFILE")) · "; else echo -n "tunnel closed · "; fi
    if answering; then echo "model answering on localhost:$PORT"; else echo "model not answering"; fi
    ;;
  *) echo "usage: scripts/gemma_tunnel.sh start|stop|status"; exit 2 ;;
esac
