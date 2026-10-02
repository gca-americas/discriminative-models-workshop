"""The arena server: one fight in memory, and the page that draws it.

This file is the game and the "You fight" mode: a person reads each move and
presses a button, or casts a spell. Other ways to play are plugins, added to
this folder in later steps:

  mode_model.py      the Discriminative model fights       (step 5)
  mode_workflow.py   an ADK workflow fights and casts       (step 6)

A plugin is a module named mode_*.py. It declares its mode and the routes it
adds; this file finds it at start-up. Nothing here talks to a model.

The rules live in engine.py, the spell cards in sigil.py. The spell card's
answer never leaves this process.

Run it:  python3 main.py
"""

from __future__ import annotations

import importlib
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import engine
import sigil

HERE = Path(__file__).resolve().parent
STATIC = HERE / "static"


def load_env(path: Path = HERE.parent / ".env") -> None:
    """KEY=value lines from the workshop's .env, without overriding the shell."""
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env()

PORT = int(os.environ.get("PORT", "8090"))


class Arena:
    """Everything the server remembers: one fight, the move on screen, and
    what was answered last. Plugins receive this object."""

    def __init__(self):
        self.lock = threading.Lock()
        self.fight = engine.Fight(mode="manual")
        self.pending: dict | None = None      # the move waiting for a response
        self.last: dict | None = None         # the last response, for the page to draw
        self.totals = {"calls": 0, "ms": 0, "tokens": 0}

    def new_fight(self, mode: str, seed=None) -> None:
        self.fight = engine.Fight(seed=seed, mode=mode)
        self.pending = self.last = None
        self.totals.update(calls=0, ms=0, tokens=0)

    def state(self) -> dict:
        return {"fight": self.fight.snapshot(), "pending": self.pending, "last": self.last,
                "log": self.fight.log[-15:], "totals": self.totals}


ARENA = Arena()


# ── plugins: the other ways to play ─────────────────────────────────────────

def load_plugins() -> list:
    """Every mode_*.py in this folder, in name order. Each declares MODE and
    LABEL, and may define ROUTES, respond(), health() and describe()."""
    found = []
    for path in sorted(HERE.glob("mode_*.py")):
        module = importlib.import_module(path.stem)
        found.append(module)
    return found


PLUGINS = load_plugins()
MODES = {"manual": None, **{p.MODE: p for p in PLUGINS}}


def describe_setup() -> dict:
    setup = {
        "ok": True,
        "modes": [{"id": "manual", "label": "You fight"}]
                 + [{"id": p.MODE, "label": p.LABEL} for p in PLUGINS],
        "opponent": engine.OPPONENT,
        "responses": {**engine.RESPONSES, "cast": engine.CAST},
        "rules": engine.RULES,
    }
    for plugin in PLUGINS:
        if hasattr(plugin, "health"):
            setup.update(plugin.health())
    return setup


# ── the game's own routes ───────────────────────────────────────────────────

def new_fight(arena: Arena, body: dict):
    mode = body.get("mode", "manual")
    if mode not in MODES:
        return 400, {"error": f"mode must be one of {', '.join(MODES)}"}
    arena.new_fight(mode, body.get("seed"))
    return 200, arena.state()


def telegraph(arena: Arena, body: dict):
    """The ogre's next move. It waits here until something responds to it."""
    if arena.fight.over:
        return 409, {"error": "the fight is over; start a new one"}
    arena.pending = {**arena.fight.next_move(), "at": time.time()}
    return 200, {"pending": arena.pending, "fight": arena.fight.snapshot()}


def respond(arena: Arena, body: dict):
    """A response to the move on screen. In "You fight" it is the button the
    person pressed. A plugin's mode decides it some other way."""
    if arena.pending is None:
        return 409, {"error": "nothing to respond to; ask for a telegraph first"}
    plugin = MODES.get(arena.fight.mode)
    if plugin is not None and hasattr(plugin, "respond"):
        return plugin.respond(arena, body)
    action = str(body.get("action", "wait"))
    if action not in engine.RESPONSES:
        return 400, {"error": f"unknown action {action}"}
    decision = {"action": action, "confidence": None, "fallback": False}
    entry = arena.fight.apply(arena.pending, decision)
    arena.last = {"decision": decision, "entry": entry}
    arena.pending = None
    return 200, {"decision": decision, "entry": entry, "fight": arena.fight.snapshot()}


def cast(arena: Arena, body: dict):
    """You fight: the person picks the spell card's color and shapes, then CAST.
    Judged against the card here, then cast as the response to the move."""
    if arena.pending is None:
        return 409, {"error": "nothing to cast at yet"}
    spell = arena.fight.sing(sigil.parse_typed(str(body.get("text", ""))))
    if spell["damage"] > 0:
        entry = arena.fight.apply(arena.pending, {"action": "cast", "fallback": False, "confidence": None})
    else:
        entry = arena.fight.apply(arena.pending, {"action": "wait", "fallback": False, "confidence": None})
        verdict = spell["verdict"]
        entry["text"] = (verdict[0].upper() + verdict[1:] + ". "
                         + (f"You take {entry['took']} while you chant." if entry.get("took")
                            else "The ogre lets it pass."))
    entry["typed"] = spell
    arena.last = {"decision": {"action": entry["action"]}, "entry": entry}
    arena.pending = None
    return 200, {"entry": entry, "spell": spell, "fight": arena.fight.snapshot()}


def pause(arena: Arena, body: dict):
    arena.fight.paused = bool(body.get("paused", True))
    return 200, {"fight": arena.fight.snapshot()}


ROUTES = {
    ("POST", "/api/fight/new"): new_fight,
    ("POST", "/api/fight/telegraph"): telegraph,
    ("POST", "/api/fight/respond"): respond,
    ("POST", "/api/fight/cast"): cast,
    ("POST", "/api/fight/pause"): pause,
}
for _plugin in PLUGINS:
    ROUTES.update(getattr(_plugin, "ROUTES", {}))
# Routes a plugin runs without holding the fight lock (they start or stop
# processes, and must not block the page's polling).
UNLOCKED = set().union(*(getattr(p, "UNLOCKED", set()) for p in PLUGINS))


# ── HTTP ────────────────────────────────────────────────────────────────────

TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
         ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml",
         ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg"}


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status, payload):
        self._send(status, json.dumps(payload).encode(), "application/json")

    def _file(self, name):
        path = (STATIC / name).resolve()
        if not path.is_file() or STATIC not in path.parents:
            self._send(404, b"not found", "text/plain; charset=utf-8")
            return
        self._send(200, path.read_bytes(), TYPES.get(path.suffix, "application/octet-stream"))

    def _route(self, method: str, body: dict) -> bool:
        route = self.path.split("?", 1)[0]
        handler = ROUTES.get((method, route))
        if handler is None:
            return False
        if (method, route) in UNLOCKED:
            status, payload = handler(ARENA, body)
        else:
            with ARENA.lock:
                status, payload = handler(ARENA, body)
        self._json(status, payload)
        return True

    def do_GET(self):
        route = self.path.split("?", 1)[0]
        if route == "/":
            self._file("index.html")
        elif route == "/api/health":
            self._json(200, describe_setup())
        elif route == "/api/fight":
            with ARENA.lock:
                self._json(200, ARENA.state())
        elif route == "/api/moves":
            self._json(200, engine.MOVES)
        elif route == "/api/sigil.png":
            with ARENA.lock:
                self._send(200, sigil.render_png(ARENA.fight.sigil), "image/png")
        elif not self._route("GET", {}):
            self._file(route.lstrip("/"))

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except ValueError:
            self._json(400, {"error": "bad json"})
            return
        if not self._route("POST", body):
            self._json(404, {"error": "not found"})

    def log_message(self, fmt, *args):
        if "/api/fight" in (args[0] if args else "") and "GET" in (args[0] if args else ""):
            return                                  # the page polls; keep the log readable
        print(f"  {fmt % args}", flush=True)


def main():
    print(f"The arena is running on http://localhost:{PORT}", flush=True)
    modes = ", ".join(m["label"] for m in describe_setup()["modes"])
    print(f"Modes: {modes}", flush=True)
    for plugin in PLUGINS:
        if hasattr(plugin, "describe"):
            print(plugin.describe(), flush=True)
    print(flush=True)
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
