"""Read a spell card with Gemini Decisions, on its own.

    python3 branches/read_card.py

A small ADK workflow of two nodes, with nothing from the arena:

    START ─► read_card ─► check

read_card sends the spell card in this folder (spell_card.png) to Gemini
Decisions with the Google Gen AI SDK, and asks four choice questions about it:
the color, and the shape in each position. check compares the answers with
the card's real answer (spell_card.json), which the model never sees.

QUESTIONS and read_card each start with a part missing, marked TODO. Step 6b
fills them in. Needs GEMINI_API_KEY in .env (step 2).
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import sys
import time
import warnings
from pathlib import Path

from google import genai
from google.adk.agents.context import Context
from google.adk.events.event import Event
from google.adk.runners import InMemoryRunner
from google.adk.workflow import Workflow
from google.genai import types

HERE = Path(__file__).resolve().parent
CARD = HERE / "spell_card.png"
ANSWER = json.loads((HERE / "spell_card.json").read_text())

# What a card can be. Each option has a description the model matches against
# what it sees.
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


def shape_question(position: str, side: str) -> dict:
    return {
        "type": "choice",
        "instructions": f"The card shows three shapes in a row. Which shape is the {position} one, on the {side}?",
        "criteria": SHAPES,
    }


# Every question is asked about the same image, in one call.
QUESTIONS = {
    # TODO: ELEMENT - add "element": a choice question with ELEMENTS as its criteria
    "first": shape_question("first", "left"),
    "second": shape_question("second", "middle"),
    "third": shape_question("third", "right"),
}


async def read_card(ctx: Context, node_input) -> Event:
    """Send the spell card to Gemini Decisions and ask what is on it."""
    png = CARD.read_bytes()
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"],
                          http_options={"api_version": "v1beta"})
    started = time.perf_counter()
    result = await client.aio.decisions.create(
        model="gemini-decision-1",
        input=[
            # TODO: IMAGE - add the card itself: an image block made from png
        ],
        questions=QUESTIONS,
    )
    ms = round((time.perf_counter() - started) * 1000)
    reading = {name: {"choice": result.answers[name].choice,
                      "confidence": round(result.answers[name].confidence, 2)}
               for name in QUESTIONS}
    return Event(output=reading, state={"reading": reading, "ms": ms,
                                        "tokens": result.usage.total_input_tokens})


def check(ctx: Context, node_input: dict) -> Event:
    """Compare the reading with the card's real answer."""
    element = node_input.get("element", {}).get("choice")
    shapes = [node_input.get(position, {}).get("choice") for position in ("first", "second", "third")]
    shapes_ok = sum(1 for want, got in zip(ANSWER["glyphs"], shapes) if want == got)
    verdict = {"element_asked": "element" in node_input, "element_ok": element == ANSWER["element"],
               "shapes_ok": shapes_ok}
    return Event(output=verdict, state=verdict)


root_agent = Workflow(
    name="read_card",
    description="Gemini Decisions reads a spell card image by answering choice questions.",
    edges=[
        ("START", read_card, check),
    ],
)


# ── running it from the terminal ─────────────────────────────────────────────

def load_env() -> None:
    env = HERE.parent / ".env"
    if env.is_file():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    # This lab reaches Gemini with GEMINI_API_KEY only. A setting left in the
    # shell by another lab would send the call somewhere else.
    os.environ.pop("GOOGLE_GENAI_USE_VERTEXAI", None)


async def main() -> int:
    load_env()
    if not os.environ.get("GEMINI_API_KEY"):
        print("There is no GEMINI_API_KEY. Add one in step 2.")
        return 2

    runner = InMemoryRunner(agent=root_agent, app_name="read_card")
    session = await runner.session_service.create_session(app_name="read_card", user_id="you")
    print(f"read_card  sending {CARD.name} to gemini-decision-1, with {len(QUESTIONS)} questions")
    message = types.Content(role="user", parts=[types.Part(text="go")])
    try:
        async for _ in runner.run_async(user_id="you", session_id=session.id, new_message=message):
            pass
    except Exception as failure:                     # no key, no image in the input, …
        print(f"Gemini Decisions did not answer: {str(failure).strip().splitlines()[0][:300]}")
        print("           Did read_card send the card? The input needs the image block.")
        return 1

    state = (await runner.session_service.get_session(
        app_name="read_card", user_id="you", session_id=session.id)).state
    reading = state.get("reading") or {}
    print(f"           answered in {state.get('ms')} ms · {state.get('tokens')} input tokens · no output tokens")
    for name, answer in reading.items():
        print(f"           {name:<8} → {answer['choice']:<9} (confidence {answer['confidence']:.2f})")
    print(f"check      card:  {ANSWER['element']} · {', '.join(ANSWER['glyphs'])}")
    if not state.get("element_asked"):
        print("           The element was not asked. Add the \"element\" question to QUESTIONS.")
    right = state.get("element_ok") and state.get("shapes_ok") == 3
    print(f"           {'right' if right else 'wrong'}: element {'✓' if state.get('element_ok') else '✗'}, "
          f"shapes {state.get('shapes_ok')} of 3")
    return 0


if __name__ == "__main__":
    warnings.filterwarnings("ignore")
    logging.disable(logging.CRITICAL)            # the script prints what matters
    sys.exit(asyncio.run(main()))
