#!/usr/bin/env bash
# Remove everything setup_gemma.sh made, after the workshop: the VM (and its
# disk, with the downloaded weights) and the IAP firewall rule. Nothing is left
# that costs money.
#
#   scripts/teardown_gemma.sh
#   scripts/teardown_gemma.sh --cloud-run   also remove what setup_gemma_cloudrun.sh made
set -euo pipefail
cd "$(dirname "$0")/.."

env_get() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- || true; }
VM="$(env_get JEV101_GEMMA_VM)"; ZONE="$(env_get JEV101_GEMMA_ZONE)"
PROJECT="$(env_get JEV101_GEMMA_PROJECT)"; PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null)}"

scripts/gemma_tunnel.sh stop 2>/dev/null || true
if [ -n "$VM" ] && [ -n "$ZONE" ]; then
  gcloud compute instances delete "$VM" --zone "$ZONE" --project "$PROJECT" --quiet || true
fi
gcloud compute firewall-rules delete allow-iap-djev --project "$PROJECT" --quiet 2>/dev/null || true

if [ "${1:-}" = "--cloud-run" ]; then
  gcloud run services delete djev-dgemma --region us-central1 --project "$PROJECT" --quiet 2>/dev/null || true
  gcloud run jobs delete djev-weights --region us-central1 --project "$PROJECT" --quiet 2>/dev/null || true
  gcloud storage rm -r "gs://${PROJECT}-djev-weights" --project "$PROJECT" 2>/dev/null || true
fi

if [ -f .env ]; then
  grep -vE '^(TYPESAFE_BASE_URL|JEV101_GEMMA_VM|JEV101_GEMMA_ZONE|JEV101_GEMMA_PROJECT|JEV101_JEV_AUTH)=' .env > .env.tmp || true
  mv .env.tmp .env
fi
echo "Removed. The workshop falls back to the Discriminative model on TypeSafe (with a key) or rehearsal mode."
