"""The arena as an ADK graph: the Discriminative model fights in real time, Gemini sings spells.

Two speeds in one workflow, which is the whole point of putting them together:

  * `tick` calls the Discriminative model every few hundred milliseconds and picks the response to
    whatever the ogre just did. It loops on itself until the fight ends.
  * `read_rune` fetches the spell card the screen is showing, as an image, and
    hands it to `spellwright`, which is Gemini. Gemini reads the shapes and
    sings the matching spell. That takes seconds. It runs on its own branch,
    in parallel, and the sung spell is judged by the arena and dropped into
    state. The next tick sees `cast` among its options; the Discriminative model decides when.
  * `bard` is Gemini once more, at the end, where prose is actually wanted.

  thread 1 (slow):  read_rune ─► spellwright (Gemini, seconds) ─► spell_ready ──┐ writes state["spell"]
                        ▲                                   "retry" on a fizzle │
  START ─► enter ─┬─────┘                                                        │
                  │                                                              ▼ (state, never a call)
  thread 2 (fast):└─► tick (Discriminative model, ~100 ms) ─► check_spell ─ "again" ─► tick ─► …
                        │ "recast" after a cast starts thread 1 again
                        └─ "done" ─► summarise ─► bard (Gemini) ─► finish

The workflow plays *against the running arena app* when it can reach one, so
the page shows the fight as it happens. With no app running it plays the same
fight against the engine in this process.

Run it from the terminal:  python3 scripts/arena.py
Or in the ADK dev UI:      adk web agents      (then pick arena)
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from google.adk.agents import LlmAgent
from google.adk.agents.context import Context
from google.adk.events.event import Event
from google.adk.workflow import Workflow
from google.genai import types
from pydantic import BaseModel, Field
from typesafe_sdk import AsyncTypeSafeClient

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "app"))
sys.path.insert(0, str(ROOT / "scripts"))
import engine  # noqa: E402
import jevauth  # noqa: E402
import reflex  # noqa: E402
import sigil  # noqa: E402


def load_env(path: Path = ROOT / ".env") -> None:
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env()

GEMINI_MODEL = os.environ.get("JEV101_GEMINI_MODEL", "gemini-flash-latest")
TICK_SECONDS = float(os.environ.get("JEV101_TICK_SECONDS", "0.5"))   # pace, so a person can watch
ARENA_URL = os.environ.get("JEV101_ARENA_URL", f"http://127.0.0.1:{os.environ.get('JEV101_APP_PORT', '8090')}")


# ── the arena, over HTTP or in-process ──────────────────────────────────────

class HttpArena:
    """The running app. Every call is a request; the page polls the same state."""

    def __init__(self, base: str):
        self.base = base.rstrip("/")

    def _call(self, path: str, body: dict | None = None, raw: bool = False):
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(self.base + path, data=data, method="POST" if data is not None else "GET",
                                         headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=20) as response:
            payload = response.read()
        return payload if raw else json.loads(payload)

    def new(self, seed):
        return self._call("/api/fight/new", {"mode": "workflow", "seed": seed})["fight"]

    def telegraph(self):
        return self._call("/api/fight/telegraph", {})["pending"]

    def respond(self, action, decision, answers, meta):
        return self._call("/api/fight/respond", {"action": action, "decision": decision,
                                                  "answers": answers, **meta})["entry"]

    def rune_png(self) -> bytes:
        return self._call("/api/sigil.png", raw=True)

    def forging(self):
        self._call("/api/spell/forging", {})

    def sung(self, sung: dict):
        return self._call("/api/spell/sung", sung)["spell"]

    def check(self, report: dict):
        self._call("/api/spell/check", report)

    def paused(self) -> bool:
        return bool(self._call("/api/fight")["fight"].get("paused"))

    def state(self):
        return self._call("/api/fight")


class LocalArena:
    """The same fight, with no app running: the engine in this process."""

    def __init__(self):
        self.fight = engine.Fight(mode="workflow")
        self.pending = None

    def new(self, seed):
        self.fight = engine.Fight(seed=seed, mode="workflow")
        return self.fight.snapshot()

    def telegraph(self):
        self.pending = self.fight.next_move()
        return self.pending

    def respond(self, action, decision, answers, meta):
        return self.fight.apply(self.pending, {**decision, "action": action})

    def rune_png(self) -> bytes:
        return sigil.render_png(self.fight.sigil)

    def forging(self):
        self.fight.spell_status = "forging"

    def sung(self, sung: dict):
        return self.fight.sing(sung)

    def check(self, report: dict):
        self.fight.extra["lastCheck"] = {"tick": self.fight.tick, **report}

    def paused(self) -> bool:
        return False

    def state(self):
        return {"fight": self.fight.snapshot(), "log": self.fight.log}


_ARENAS: dict[str, HttpArena | LocalArena] = {}


def _arena(ctx: Context):
    if ctx.session.id not in _ARENAS:
        try:
            urllib.request.urlopen(ARENA_URL + "/api/health", timeout=1.5)
            _ARENAS[ctx.session.id] = HttpArena(ARENA_URL)
        except (urllib.error.URLError, TimeoutError, OSError):
            _ARENAS[ctx.session.id] = LocalArena()
    return _ARENAS[ctx.session.id]


# ── the slow branch: read the spell card, sing the spell ──────────────────────────

class Sung(BaseModel):
    element: str = Field(description="One of: fire, frost, earth, storm. Read it from the colour.")
    glyphs: list[str] = Field(description="The three shapes, left to right. Each is exactly one of: "
                                          + ", ".join(sigil.GLYPHS))
    incantation: str = Field(description="One shouted line under twelve words that names the element.")


def read_rune(ctx: Context, node_input) -> Event:
    """Grab the spell card off the screen, as an image, and hand it to Gemini."""
    arena = _arena(ctx)
    arena.forging()
    png = arena.rune_png()
    content = types.Content(role="user", parts=[
        types.Part(text="This spell card is on the arena's screen right now. Sing the spell that matches it."),
        types.Part.from_bytes(data=png, mime_type="image/png"),
    ])
    return Event(output=content, state={"forging_since": round(time.perf_counter() - ctx.state.get("t0", 0), 2)})


spellwright = LlmAgent(
    name="spellwright",
    model=GEMINI_MODEL,
    description="Reads the spell card on the screen and sings the matching spell.",
    instruction=(
        "You are the spellwright for a fighter in an arena. You receive an image of a spell card: a "
        "coloured border and three shapes in a row. The colour is the element: red-orange is fire, "
        "light blue is frost, green is earth, purple is storm. Read the three shapes left to right. "
        "Each is exactly one of: " + ", ".join(sigil.GLYPHS) + ". A ring is a hollow circle; a bar is "
        "a horizontal line; a crescent is a circle with a bite out of its right side. Return the "
        "element, the shapes in order, and a short incantation that names the element."
    ),
    output_schema=Sung,
    output_key="sung",
)


def spell_ready(ctx: Context, node_input: dict) -> Event:
    """The arena judges the song against the spell card. Only the arena knows the
    answer. The result lands in state; no output, so this branch never ends
    the graph. A fizzle burns the spell card, so the branch reads the new one."""
    spell = _arena(ctx).sung(dict(node_input))
    spell["ready_at"] = round(time.perf_counter() - ctx.state.get("t0", 0), 2)
    fizzled = spell["damage"] <= 0 and int(ctx.state.get("tick", 0)) < engine.MAX_TICKS
    return Event(state={"spell": spell if spell["damage"] > 0 else None, "last_song": spell},
                 route="retry" if fizzled else "stored")


def rest(node_input) -> None:
    """Thread 1 has put the spell in the slot. It has nothing to do until the
    fight casts it and routes "recast". Returning None ends this branch
    without producing an output, so it is not a second ending of the graph."""
    return None


# ── the fast loop ───────────────────────────────────────────────────────────

def enter(ctx: Context, node_input) -> Event:
    """Ring the bell. Fan out: the spellwright starts reading, and so does the fight."""
    _ARENAS.pop(ctx.session.id, None)
    arena = _arena(ctx)
    arena.new(ctx.state.get("seed"))
    return Event(output="fight", state={"t0": time.perf_counter(), "tick": 0, "spell": None,
                                        "you": engine.YOU_HP, "foe": engine.FOE_HP,
                                        "jev_tokens": 0, "jev_ms": 0, "spells_cast": 0,
                                        "arena": "screen" if isinstance(arena, HttpArena) else "local"})


async def tick(ctx: Context, node_input) -> Event:
    """One exchange. The Discriminative model reads the telegraph, the arena resolves the blow.
    Async, so the spellwright's branch keeps running while this one waits."""
    arena = _arena(ctx)
    spell = ctx.state.get("spell")                   # the slow branch may have delivered
    await asyncio.sleep(TICK_SECONDS)
    # Pause on the page holds the fight here, between exchanges. The slow
    # thread is not held: a spell can finish while the fight is paused.
    while await asyncio.to_thread(arena.paused):
        await asyncio.sleep(0.4)
    move = await asyncio.to_thread(arena.telegraph)

    await asyncio.to_thread(jevauth.prepare)      # a Cloud Run token, when that is the backend
    started = time.perf_counter()
    async with AsyncTypeSafeClient(**jevauth.client_kwargs()) as jev:
        answers = await jev.system_one(
            state={"opponent": engine.OPPONENT["description"], "telegraph": move["telegraph"]},
            questions=reflex.reflex_questions(spell_ready=spell is not None),
        )
    ms = round((time.perf_counter() - started) * 1000)

    decision = reflex.choose(answers.answers, spell_ready=spell is not None)
    entry = await asyncio.to_thread(
        arena.respond, decision["action"], decision,
        {name: answer.model_dump() for name, answer in answers.answers.items()},
        {"model": answers.model, "latencyMs": ms, "inputTokens": answers.usage.input_tokens or 0},
    )
    entry["ms"] = ms
    entry["at"] = round(time.perf_counter() - ctx.state.get("t0", 0), 2)
    over = entry["you"] <= 0 or entry["foe"] <= 0 or entry["tick"] >= engine.MAX_TICKS

    delta = {
        "tick": entry["tick"], "you": entry["you"], "foe": entry["foe"], "last": entry,
        "jev_tokens": int(ctx.state.get("jev_tokens", 0)) + (answers.usage.input_tokens or 0),
        "jev_ms": int(ctx.state.get("jev_ms", 0)) + ms,
    }
    routes = []
    if entry["spell_used"]:
        delta["spell"] = None
        delta["spells_cast"] = int(ctx.state.get("spells_cast", 0)) + 1
        if not over:
            routes.append("recast")                  # a new spell card is on the screen: read it
            delta["forging_since"] = entry["at"]     # thread 1 starts singing again now
    routes.append("done" if over else "next")
    return Event(output="fight", route=routes, state=delta)


def check_spell(ctx: Context, node_input) -> Event:
    """After every exchange, a glance at the spell slot. It never waits: if
    Gemini is still singing, it says so and the fight goes on. This is the
    only place the two branches meet, and they meet through state."""
    spell = ctx.state.get("spell")
    now = round(time.perf_counter() - ctx.state.get("t0", 0), 2)
    if spell:
        report = {"ready": True, "name": spell.get("incantation"), "waited": None}
    else:
        since = ctx.state.get("forging_since")
        report = {"ready": False, "name": None,
                  "waited": round(now - since, 1) if since is not None else None}
    _arena(ctx).check(report)
    return Event(output="fight", route="again",
                 state={"spell_check": {"tick": ctx.state.get("tick", 0), "at": now, **report}})


# ── Gemini again, at the end, where prose belongs ───────────────────────────

class Tale(BaseModel):
    title: str
    tale: str = Field(description="The fight retold in under 80 words, present tense.")


bard = LlmAgent(
    name="bard",
    model=GEMINI_MODEL,
    description="Retells the fight.",
    instruction=(
        "You are the arena's bard. You receive the fight log as JSON: each tick has the ogre's "
        "telegraph, the response chosen, the outcome, and hit points, plus every spell that was "
        "sung. Retell it in under 80 words, present tense, quoting at least one incantation. "
        "Say who won."
    ),
    output_schema=Tale,
    output_key="tale",
)


def summarise(ctx: Context, node_input) -> dict:
    """Hand the bard the log."""
    state = _arena(ctx).state()
    fight = state["fight"]
    return {"result": fight["result"], "ticks": fight["tick"], "spells": fight.get("castings", []),
            "log": [{"tick": e["tick"], "ogre": e["telegraph"], "you": e["action"], "outcome": e["text"],
                     "hp": {"you": e["you"], "ogre": e["foe"]}} for e in state["log"]]}


def finish(ctx: Context, node_input: dict) -> Event:
    fight = _arena(ctx).state()["fight"]
    tale = node_input if isinstance(node_input, dict) else {"title": "", "tale": str(node_input)}
    return Event(message=f"{tale.get('title', '')}\n\n{tale.get('tale', '')}",
                 output=fight["result"], state={"result": fight["result"], "tale": tale})


root_agent = Workflow(
    name="arena",
    description="The Discriminative model fights tick by tick while Gemini reads spell cards and sings spells in parallel.",
    edges=[
        ("START", enter),
        (enter, (read_rune, tick)),                   # fan-out: slow branch + fast loop
        (read_rune, spellwright, spell_ready),
        (spell_ready, {"retry": read_rune, "stored": rest}),   # misread: read the new spell card; else rest
        (tick, {"next": check_spell, "recast": read_rune, "done": summarise}),
        (check_spell, {"again": tick}),               # not ready? keep fighting; ready? cast is offered
        (summarise, bard, finish),
    ],
)
