#!/usr/bin/env bash
# Build the workbench page into web/dist and record what it was built from.
# Needs Node 20 or newer. Run it after changing anything under web/, and commit
# web/dist with the change: setup uses the shipped page and skips Node.
set -euo pipefail
cd "$(dirname "$0")/.."
(cd web && { [ -d node_modules ] || npm install --no-fund --no-audit; } && npm run build)
python3 scripts/page_hash.py > web/dist/.srchash
echo "page built · $(cut -c1-12 web/dist/.srchash)"
