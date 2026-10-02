#!/usr/bin/env bash
# Start or stop the DiffusionGemma VM.
#
#   scripts/gemma_warm.sh on     start it (about 2 minutes until the model answers)
#   scripts/gemma_warm.sh off    stop it: no GPU charge, only the disk (~$10/month)
#
# Reads the VM from .env (setup_gemma.sh writes it).
set -euo pipefail
cd "$(dirname "$0")/.."

env_get() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- || true; }
VM="$(env_get JEV101_GEMMA_VM)"; ZONE="$(env_get JEV101_GEMMA_ZONE)"; PROJECT="$(env_get JEV101_GEMMA_PROJECT)"
[ -n "$VM" ] || { echo "no DiffusionGemma VM in .env (run scripts/setup_gemma.sh)"; exit 2; }

case "${1:-}" in
  on)
    gcloud compute instances start "$VM" --zone "$ZONE" --project "$PROJECT" --quiet
    echo "waiting for the model to load…"
    for _ in $(seq 1 30); do
      gcloud compute ssh "$VM" --zone "$ZONE" --project "$PROJECT" --tunnel-through-iap --quiet \
        --command 'curl -s -m 5 localhost:8080/health' 2>/dev/null | grep -q '"ok"' && break
      sleep 10
    done
    scripts/gemma_tunnel.sh start
    ;;
  off)
    scripts/gemma_tunnel.sh stop || true
    gcloud compute instances stop "$VM" --zone "$ZONE" --project "$PROJECT" --quiet
    echo "$VM stopped"
    ;;
  *) echo "usage: scripts/gemma_warm.sh on|off"; exit 2 ;;
esac
