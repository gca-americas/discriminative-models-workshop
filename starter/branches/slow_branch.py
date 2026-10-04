"""The slow branch on its own: Gemini reads an image and answers in a fixed shape.

    python3 branches/slow_branch.py

A small ADK workflow of three nodes, with nothing from the arena:

    START ─► show_card ─► reader (Gemini) ─► check

show_card sends the spell card in this folder (spell_card.png) to Gemini as an
image. reader is an LlmAgent whose answer must fit the Spell schema. The graph hands
that answer to check, which compares it with the card's real answer (spell_card.json), which
Gemini never sees.

show_card and reader start with parts missing, marked TODO. Step 6b fills them in.
Needs Gemini: an AI Studio key, or Vertex AI (see step 2).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
import warnings
from pathlib import Path

from google.adk.agents import LlmAgent
from google.adk.agents.context import Context
from google.adk.events.event import Event
from google.adk.runners import InMemoryRunner
from google.adk.workflow import Workflow
from google.genai import types
from pydantic import BaseModel

HERE = Path(__file__).resolve().parent


def load_env() -> None:
    env = HERE.parent / ".env"
    if env.is_file():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    if os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in ("1", "true"):
        os.environ.setdefault("GOOGLE_CLOUD_LOCATION", "global")


load_env()                       # before GEMINI_MODEL below reads it

CARD = HERE / "spell_card.png"
ANSWER = json.loads((HERE / "spell_card.json").read_text())
GEMINI_MODEL = os.environ.get("JEV101_GEMINI_MODEL", "gemini-flash-latest")


class Spell(BaseModel):
    element: str          # fire, frost, earth or storm: the colour of the border
    glyphs: list[str]     # the three shapes, left to right
    incantation: str      # one shouted line that names the element


def show_card(ctx: Context, node_input) -> Event:
    """Send the spell card to Gemini: a line of text and the image itself."""
    png = CARD.read_bytes()
    return Event(output=types.Content(role="user", parts=[
        types.Part(text="Here is a spell card. Read it and sing the matching spell."),
        # TODO: IMAGE - add the card itself: an image part made from png
    ]), state={"sent_at": time.perf_counter()})


# What the reader is told, every time. The card itself arrives as its user turn.
INSTRUCTION = (
    "You read spell cards. A card has a coloured border and three "
    "shapes in a row. The colour is the element: red-orange is fire, "
    "light blue is frost, green is earth, purple is storm. Read the "
    "three shapes left to right. Each is exactly one of: circle, ring, "
    "square, diamond, triangle, cross, crescent, bar. A ring is a "
    "hollow circle; a bar is a horizontal line; a crescent is a circle "
    "with a bite out of its right side. Return the element, the shapes "
    "in order, and a short incantation that names the element. If there "
    "is no image, say so in the incantation and guess."
)

reader = LlmAgent(
    name="reader",
    model=GEMINI_MODEL,
    # TODO: AGENT - tell it what to do, and the shape its answer must have
)


def check(ctx: Context, node_input) -> Event:
    """Compare Gemini's reading with the card's real answer."""
    seconds = round(time.perf_counter() - ctx.state.get("sent_at", time.perf_counter()), 1)
    if not isinstance(node_input, dict):              # free text: the reader has no output_schema
        return Event(output={"element_ok": False, "shapes_ok": 0},
                     state={"seconds": seconds, "element_ok": False, "shapes_ok": 0, "free_text": str(node_input)[:200]})
    element_ok = str(node_input.get("element", "")).lower() == ANSWER["element"]
    glyphs = [str(g).lower() for g in node_input.get("glyphs") or []]
    shapes_ok = sum(1 for want, got in zip(ANSWER["glyphs"], glyphs) if want == got)
    return Event(output={"element_ok": element_ok, "shapes_ok": shapes_ok},
                 state={"seconds": seconds, "spell": node_input,
                        "element_ok": element_ok, "shapes_ok": shapes_ok})


root_agent = Workflow(
    name="slow_branch",
    description="Gemini reads a spell card image and answers in a fixed shape.",
    edges=[
        ("START", show_card),
        (show_card, reader, check),
    ],
)


# ── running it from the terminal ─────────────────────────────────────────────


async def main() -> int:
    if not (os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
            or os.environ.get("GOOGLE_GENAI_USE_VERTEXAI")):
        print("Gemini is not set up. See step 2, or run python3 scripts/check_setup.py.")
        return 2

    runner = InMemoryRunner(agent=root_agent, app_name="slow_branch")
    session = await runner.session_service.create_session(app_name="slow_branch", user_id="you")
    print(f"show_card  sending {CARD.name} to Gemini ({GEMINI_MODEL})")
    message = types.Content(role="user", parts=[types.Part(text="go")])
    try:
        async for _ in runner.run_async(user_id="you", session_id=session.id, new_message=message):
            pass
    except Exception as failure:                     # no credentials, no access to the model, …
        print(f"Gemini did not answer: {str(failure)[:300]}")
        return 1

    state = (await runner.session_service.get_session(
        app_name="slow_branch", user_id="you", session_id=session.id)).state
    spell = state.get("spell") if isinstance(state.get("spell"), dict) else {}
    if state.get("free_text"):
        print(f"reader     Gemini answered in {state.get('seconds')} s, in free text, not a Spell:")
        print(f"           {state['free_text']}")
        print("           Give reader an instruction and an output_schema.")
        return 0
    print(f"reader     Gemini answered in {state.get('seconds')} s")
    print(f"           read:  {spell.get('element')} · {', '.join(spell.get('glyphs') or [])}"
          f"  “{spell.get('incantation', '')}”")
    print(f"check      card:  {ANSWER['element']} · {', '.join(ANSWER['glyphs'])}")
    right = state.get("element_ok") and state.get("shapes_ok") == 3
    print(f"           {'right' if right else 'wrong'}: element {'✓' if state.get('element_ok') else '✗'}, "
          f"shapes {state.get('shapes_ok')} of 3")
    if not right:
        print("           Did Gemini see the card? Check that show_card sends the image part.")
    return 0


if __name__ == "__main__":
    warnings.filterwarnings("ignore")
    logging.disable(logging.CRITICAL)            # the script prints what matters
    sys.exit(asyncio.run(main()))
