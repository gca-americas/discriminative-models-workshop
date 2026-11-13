"""The arena as an ADK graph: a fight loop, a card reader beside it, and a bard at the end.

  * `tick` asks the decision model you chose in step 2 (Jev, DiffusionGemma or
    Gemini Decisions) what to do about the ogre's move, and picks the next edge.
    It loops on itself until the fight ends, and never waits for the card.
  * `read_card` fetches the spell card the screen is showing, as an image, and
    asks Gemini Decisions four choice questions about it: the color, and the
    shape in each position. It runs alongside the fight, at the same time as the
    fight. The arena judges the reading and the spell goes into state. The
    next tick sees `cast` among its options.
  * `bard` is Gemini, a language model, once, at the end, where prose is wanted.

  START ─► enter ─┬─► read_card ─► writes state["spell"]        "again" after a misread
                  │       ▲
                  │       └──── "read": a spell was cast, a new card is up
                  │
                  └─► tick ─┬─ "next" ─► tick                    reads state["spell"] every tick
                            └─ "done" ─► summarize ─► bard (Gemini) ─► finish

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
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "app"))
sys.path.insert(0, str(ROOT / "scripts"))
import decisions  # noqa: E402
import engine  # noqa: E402
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
# The card reader and the bard both use the Gemini Developer API with
# GEMINI_API_KEY. Vertex AI settings left in the shell would send the bard there.
os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "false"

# A versioned name: the "-latest" alias is not served on the API version the
# Google Gen AI SDK 3.x uses by default. Setup saves a checked name in .env.
GEMINI_MODEL = os.environ.get("JEV101_GEMINI_MODEL") or "gemini-3.8-flash"
TICK_SECONDS = float(os.environ.get("JEV101_TICK_SECONDS", "0.1"))   # a short pause, so a person can watch
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

    def tale(self, tale: dict):
        self._call("/api/workflow/tale", tale)

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

    def tale(self, tale: dict):
        self.fight.extra["tale"] = tale

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


# ── reading the spell card: Gemini Decisions, with the Google Gen AI SDK ─────

# What a card can be, as choice questions. The criteria describe each option,
# so the model matches what it sees against words.
ELEMENTS = {
    "fire": "The card is red-orange.",
    "frost": "The card is light blue.",
    "earth": "The card is green.",
    "storm": "The card is purple.",
}
SHAPES = {
    "circle": "A solid filled circle.",
    "ring": "A hollow circle: an outline with an empty middle.",
    "square": "A solid filled square.",
    "diamond": "A square turned on its corner.",
    "triangle": "A solid triangle pointing up.",
    "cross": "A plus sign.",
    "crescent": "A circle with a bite taken out of its right side.",
    "bar": "A flat horizontal line.",
}
POSITIONS = {"first": "left", "second": "middle", "third": "right"}

# A decision model picks from options; it does not write. The words of the
# spell are fixed, one line per element.
INCANTATIONS = {
    "fire": "Fire, burn the ogre down!",
    "frost": "Frost, freeze it where it stands!",
    "earth": "Earth, rise and break its stride!",
    "storm": "Storm, strike it from the sky!",
}


def card_questions() -> dict[str, dict]:
    """Four choice questions about one image: the color, and each shape."""
    questions = {"element": {
        "type": "choice",
        "instructions": "What color is this spell card? The color is its element.",
        "criteria": ELEMENTS,
    }}
    for position, side in POSITIONS.items():
        questions[position] = {
            "type": "choice",
            "instructions": f"The card shows three shapes in a row. Which shape is the {position} one, on the {side}?",
            "criteria": SHAPES,
        }
    return questions


async def read_card(ctx: Context, node_input) -> Event:
    """Grab the spell card off the screen, as an image, and ask Gemini Decisions
    what is on it. One call, four answers. The arena judges the reading against
    the card's answer, which never leaves the server.

    This runs alongside the fight. While it awaits the model, the fight keeps
    ticking. The result lands in state; there is no output, so the card reader
    never ends the graph."""
    arena = _arena(ctx)
    await asyncio.to_thread(arena.forging)
    png = await asyncio.to_thread(arena.rune_png)

    started = time.perf_counter()
    answered = await decisions.ask_gemini_async([decisions.image_block(png)], card_questions())
    ms = round((time.perf_counter() - started) * 1000)

    read = answered.answers
    element = read["element"].choice
    sung = {"element": element, "glyphs": [read[position].choice for position in POSITIONS],
            "incantation": INCANTATIONS[element],
            # the model's four answers, so the page can show how the card was read
            "reading": {"answers": answered.dump(), "model": answered.model,
                        "latencyMs": ms, "inputTokens": answered.input_tokens}}
    spell = await asyncio.to_thread(arena.sung, sung)
    spell["ms"] = ms
    spell["confidence"] = round(min(answer.confidence for answer in read.values()), 2)
    spell["at"] = round(time.perf_counter() - ctx.state.get("t0", 0), 2)
    fizzled = spell["damage"] <= 0                   # a misread burns the card: a new one is up
    fighting = not ctx.state.get("over") and int(ctx.state.get("tick", 0)) < engine.MAX_TICKS
    return Event(route="again" if fizzled and fighting else "stored", state={
        "spell": None if fizzled else spell,
        "last_song": spell,
        "card_reads": int(ctx.state.get("card_reads", 0)) + 1,
        "card_ms": int(ctx.state.get("card_ms", 0)) + ms,
        "card_tokens": int(ctx.state.get("card_tokens", 0)) + answered.input_tokens,
    })


def rest(node_input) -> None:
    """The spell is in state. The card reader has nothing to do until the fight
    casts it and routes "read". Returning None ends it without an
    output, so it is not a second ending of the graph."""
    return None


# ── the loop ────────────────────────────────────────────────────────────────

def enter(ctx: Context, node_input) -> Event:
    """Ring the bell: a new fight, and a clean state. Two edges leave this
    node, so the card reader and the fight start together."""
    _ARENAS.pop(ctx.session.id, None)
    arena = _arena(ctx)
    arena.new(ctx.state.get("seed"))
    return Event(output="fight", state={"t0": time.perf_counter(), "tick": 0, "spell": None,
                                        "you": engine.YOU_HP, "foe": engine.FOE_HP,
                                        "jev_tokens": 0, "jev_ms": 0, "spells_cast": 0, "over": False,
                                        "card_reads": 0, "card_ms": 0, "card_tokens": 0,
                                        "arena": "screen" if isinstance(arena, HttpArena) else "local"})


async def tick(ctx: Context, node_input) -> Event:
    """One exchange. The decision model reads the telegraph, the arena resolves
    the blow, and the route says where the graph goes next. Async, so the card
    reader keeps running in the background while this waits for its model."""
    arena = _arena(ctx)
    spell = ctx.state.get("spell")                   # what read_card left in state, if it has finished
    await asyncio.sleep(TICK_SECONDS)
    # Pause on the page holds the fight here, between exchanges.
    while await asyncio.to_thread(arena.paused):
        await asyncio.sleep(0.4)
    move = await asyncio.to_thread(arena.telegraph)

    started = time.perf_counter()
    answered = await decisions.ask_async(
        about={"opponent": engine.OPPONENT["description"], "telegraph": move["telegraph"]},
        questions=reflex.reflex_questions(spell_ready=spell is not None),
    )
    ms = round((time.perf_counter() - started) * 1000)

    decision = reflex.choose(answered.answers, spell_ready=spell is not None)
    entry = await asyncio.to_thread(
        arena.respond, decision["action"], decision, answered.dump(),
        {"model": answered.model, "latencyMs": ms, "inputTokens": answered.input_tokens,
         "costUsd": answered.cost_usd},
    )
    entry["ms"] = ms
    entry["at"] = round(time.perf_counter() - ctx.state.get("t0", 0), 2)
    over = entry["you"] <= 0 or entry["foe"] <= 0 or entry["tick"] >= engine.MAX_TICKS

    delta = {
        "tick": entry["tick"], "you": entry["you"], "foe": entry["foe"], "last": entry,
        "jev_tokens": int(ctx.state.get("jev_tokens", 0)) + answered.input_tokens,
        "jev_cost": float(ctx.state.get("jev_cost", 0.0)) + answered.cost_usd,
        "jev_ms": int(ctx.state.get("jev_ms", 0)) + ms,
    }
    routes = []                                      # which edges to follow next
    if entry["spell_used"]:
        delta["spell"] = None                        # spent: the screen draws a new card
        delta["spells_cast"] = int(ctx.state.get("spells_cast", 0)) + 1
        if not over:
            routes.append("read")                    # start reading the new card, in the background
    if over:
        delta["over"] = True
    routes.append("done" if over else "next")        # and keep fighting, or end
    return Event(output="fight", route=routes, state=delta)


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
        "read from a spell card and cast. Retell it in under 80 words, present tense, quoting at "
        "least one incantation if a spell was cast. Say who won."
    ),
    output_schema=Tale,
    output_key="tale",
)


def summarize(ctx: Context, node_input) -> dict:
    """Hand the bard the log."""
    state = _arena(ctx).state()
    fight = state["fight"]
    return {"result": fight["result"], "ticks": fight["tick"], "spells": fight.get("castings", []),
            "log": [{"tick": e["tick"], "ogre": e["telegraph"], "you": e["action"], "outcome": e["text"],
                     "hp": {"you": e["you"], "ogre": e["foe"]}} for e in state["log"]]}


def finish(ctx: Context, node_input: dict) -> Event:
    fight = _arena(ctx).state()["fight"]
    tale = node_input if isinstance(node_input, dict) else {"title": "", "tale": str(node_input)}
    _arena(ctx).tale({"title": tale.get("title", ""), "tale": tale.get("tale", "")})   # for the page to show
    return Event(message=f"{tale.get('title', '')}\n\n{tale.get('tale', '')}",
                 output=fight["result"], state={"result": fight["result"], "tale": tale})


root_agent = Workflow(
    name="arena",
    description="A decision model fights tick by tick, Gemini Decisions reads the spell cards, and Gemini tells the tale.",
    edges=[
        ("START", enter),
        (enter, (read_card, tick)),                   # fan-out: read the card and fight, together
        (read_card, {"again": read_card, "stored": rest}),
        (tick, {"next": tick, "read": read_card, "done": summarize}),
        (summarize, bard, finish),
    ],
)
