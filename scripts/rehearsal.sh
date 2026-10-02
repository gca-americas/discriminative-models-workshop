#!/usr/bin/env bash
# The rehearsal stand-in (scripts/fake_jev.py): a word list that speaks the
# same API as the Discriminative model, for running the workshop with no key
# and no GPU. It proves the plumbing; its numbers mean nothing.
#
#   scripts/rehearsal.sh start     run it in the background on :4811
#   scripts/rehearsal.sh stop
#   scripts/rehearsal.sh status
#
# scripts/start.sh starts it for you when .env has JEV101_REHEARSAL=1.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${JEV101_FAKE_PORT:-4811}"
PIDFILE=runs/fake-jev.pid
mkdir -p runs

answering() { curl -s -m 2 "http://127.0.0.1:$PORT/health" >/dev/null 2>&1; }
running() { [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }

case "${1:-status}" in
  start)
    if answering; then echo "rehearsal stand-in already answering on :$PORT"; exit 0; fi
    ( nohup .venv/bin/python scripts/fake_jev.py > runs/fake-jev.log 2>&1 < /dev/null &
      echo $! > "$PIDFILE" )
    for _ in $(seq 1 20); do answering && break; sleep 0.25; done
    if answering; then echo "rehearsal stand-in answering on :$PORT"
    else echo "rehearsal stand-in did not start; see runs/fake-jev.log"; exit 1; fi
    ;;
  stop)
    running && kill "$(cat "$PIDFILE")" && echo "rehearsal stand-in stopped" || echo "rehearsal stand-in not running"
    rm -f "$PIDFILE"
    ;;
  status)
    if answering; then echo "rehearsal stand-in answering on :$PORT"; else echo "rehearsal stand-in not running"; fi
    ;;
  *) echo "usage: scripts/rehearsal.sh start|stop|status"; exit 2 ;;
esac
