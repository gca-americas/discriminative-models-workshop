"""Plugin: the workflow fights. Added in step 6, on top of step 5.

The ADK workflow (agents/arena/agent.py) plays in its own process and talks
to this server over HTTP, like any other client:

  thread 2, fast   asks for each move, asks the Discriminative model, and
                   posts the decision to /api/fight/respond
  thread 1, slow   fetches the spell card image, has Gemini sing the spell,
                   and posts it to /api/spell/sung to be judged here

The page only draws. Start on the page launches the workflow with
/api/workflow/start; it is the same program as `python3 scripts/arena.py`.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
from pathlib import Path

import engine

MODE = "workflow"
LABEL = "Workflow fights"

ROOT = Path(__file__).resolve().parent.parent
LOG = ROOT / "runs" / "arena-workflow.log"
PROCESS: dict = {"proc": None}


# ── the workflow process ────────────────────────────────────────────────────

def running() -> bool:
    proc = PROCESS["proc"]
    return proc is not None and proc.poll() is None


def stop(arena=None, body=None):
    proc = PROCESS["proc"]
    if proc is not None and proc.poll() is None:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except OSError:
            pass
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            os.killpg(proc.pid, signal.SIGKILL)
    PROCESS["proc"] = None
    return 200, status()


def start(arena, body: dict):
    stop()
    LOG.parent.mkdir(exist_ok=True)
    argv = [sys.executable, str(ROOT / "scripts" / "arena.py")]
    if body.get("seed") is not None:
        argv += ["--seed", str(int(body["seed"]))]
    port = os.environ.get("PORT", "8090")
    env = {**os.environ, "PYTHONUNBUFFERED": "1", "JEV101_ARENA_URL": f"http://127.0.0.1:{port}"}
    with open(LOG, "w", encoding="utf-8") as log:
        PROCESS["proc"] = subprocess.Popen(argv, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT,
                                           stdin=subprocess.DEVNULL, env=env, start_new_session=True)
    return 200, {"started": True, "pid": PROCESS["proc"].pid}


def status(arena=None, body=None):
    proc = PROCESS["proc"]
    tail = ""
    if LOG.exists():
        lines = [line for line in LOG.read_text(errors="replace").splitlines()
                 if line.strip() and not line.startswith("WARNING") and "AFC" not in line]
        tail = "\n".join(lines[-6:])
    payload = {"running": running(),
               "exitCode": None if proc is None or proc.poll() is None else proc.returncode,
               "tail": tail}
    return (200, payload) if arena is not None else payload


# ── what the workflow posts ─────────────────────────────────────────────────

def respond(arena, body: dict):
    """Thread 2's decision for the move on screen, with the model's answers,
    so the page can draw the same cards as in step 5."""
    action = str(body.get("action", "wait"))
    if action not in engine.RESPONSES and action != "cast":
        return 400, {"error": f"unknown action {action}"}
    decision = {**(body.get("decision") or {}), "action": action}
    decision.setdefault("confidence", None)
    decision.setdefault("fallback", False)
    entry = arena.fight.apply(arena.pending, decision)
    asked = {"decision": decision}
    if body.get("answers"):
        asked = {"decision": decision, "answers": body["answers"], "model": body.get("model", ""),
                 "latencyMs": body.get("latencyMs", 0), "inputTokens": body.get("inputTokens", 0),
                 "costUsd": 0.0}
        arena.totals["calls"] += 1
        arena.totals["ms"] += int(body.get("latencyMs", 0))
        arena.totals["tokens"] += int(body.get("inputTokens", 0))
        entry["latencyMs"] = asked["latencyMs"]
    arena.last = {**asked, "entry": entry, "totals": dict(arena.totals)}
    arena.pending = None
    return 200, {**asked, "entry": entry, "fight": arena.fight.snapshot(), "totals": arena.totals}


def forging(arena, body: dict):
    """Thread 1 has started reading the spell card."""
    if arena.fight.spell is None:
        arena.fight.spell_status = "forging"
    return 200, {"fight": arena.fight.snapshot()}


def sung(arena, body: dict):
    """Thread 1's spell, judged here against the card's hidden answer."""
    spell = arena.fight.sing(body)
    return 200, {"spell": spell, "fight": arena.fight.snapshot()}


def check(arena, body: dict):
    """Thread 2 looked at the spell slot after an exchange. The page pings the
    spell card in the corner each time."""
    arena.fight.extra["lastCheck"] = {"tick": arena.fight.tick, "ready": bool(body.get("ready")),
                                      "waited": body.get("waited"), "name": body.get("name")}
    return 200, {"fight": arena.fight.snapshot()}


ROUTES = {
    ("GET", "/api/workflow"): status,
    ("POST", "/api/workflow/start"): start,
    ("POST", "/api/workflow/stop"): stop,
    ("POST", "/api/spell/forging"): forging,
    ("POST", "/api/spell/sung"): sung,
    ("POST", "/api/spell/check"): check,
}
UNLOCKED = {("GET", "/api/workflow"), ("POST", "/api/workflow/start"), ("POST", "/api/workflow/stop")}
