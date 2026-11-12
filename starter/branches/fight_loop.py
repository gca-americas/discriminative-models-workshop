"""The fight loop on its own: the decision model decides, once per tick.

    python3 branches/fight_loop.py

A small ADK workflow of two nodes, with nothing from the arena:

    START ─► tick ─"next"─► tick ─► … ─"done"─► report

Each tick takes the next move from MOVES, asks the decision model which
response is right, and picks the edge to take next: "next" loops back to
tick, "done" ends the loop after the last move. The decision for each tick is
written to state, so report can read them all.

The model is the one you chose in step 2. ask_async, from scripts/decisions.py,
sends the request with the TypeSafe SDK (Jev, DiffusionGemma) or the Google
Gen AI SDK (Gemini Decisions).

tick starts unassembled, marked TODO. Step 6b assembles it.
"""

from __future__ import annotations

import asyncio
import logging
import sys
import time
import warnings
from pathlib import Path

from google.adk.agents.context import Context
from google.adk.events.event import Event
from google.adk.runners import InMemoryRunner
from google.adk.workflow import Workflow
from google.genai import types

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
from decisions import ModelError, ask_async  # noqa: E402
from jev_common import load_env  # noqa: E402

OPPONENT = "a nine-foot ogre with a spiked club, thick hide, and a short temper"

# What the ogre does, one move per tick.
MOVES = [
    "The ogre raises its club high over its head.",
    "The ogre sweeps its club low, at your knees.",
    "The ogre lowers its head and charges.",
    "The ogre staggers, off balance, its guard wide open.",
    "The ogre feints left, watching your shield.",
]

# The responses the model chooses from, and when each one is right.
RESPONSES = {
    "block_high": "Raise the shield against a high swing.",
    "block_low": "Drop the shield against a swing at the legs.",
    "dodge": "Step aside from a charge or a thrown object.",
    "strike": "Attack now, while the opponent is exposed.",
    "wait": "Hold and watch, against a feint.",
}


# What tick asks about each move. The same shape as step 5a's question.
QUESTIONS = {
    "response": {
        "type": "choice",
        "instructions": "The opponent has just done this. What is the right response?",
        "criteria": RESPONSES,
    },
}


async def tick(ctx: Context, node_input) -> Event:
    """One move, one decision, then pick the next edge."""
    number = int(ctx.state.get("tick", 0)) + 1
    move = MOVES[number - 1]
    # TODO: TICK - assemble the rest of tick in step 6b: ask the model, read its answer, pick the edge
    raise NotImplementedError("tick is not assembled yet: build it in step 6b")


def report(ctx: Context, node_input) -> Event:
    """The loop is over: how many ticks ran."""
    return Event(output={"ticks": ctx.state.get("tick", 0)})


root_agent = Workflow(
    name="fight_loop",
    description="The decision model decides once per tick, in a loop.",
    edges=[
        ("START", tick),
        (tick, {"next": tick, "done": report}),
    ],
)


# ── running it from the terminal ─────────────────────────────────────────────

async def main() -> int:
    load_env()
    runner = InMemoryRunner(agent=root_agent, app_name="fight_loop")
    session = await runner.session_service.create_session(app_name="fight_loop", user_id="you")
    message = types.Content(role="user", parts=[types.Part(text="go")])
    try:
        async for event in runner.run_async(user_id="you", session_id=session.id, new_message=message):
            decision = event.output if isinstance(event.output, dict) and "move" in event.output else None
            if decision and decision["tick"] == 1:
                print(f"model   {decision['model']} · {decision['sdk']}")
            if decision:
                print(f"tick {decision['tick']}  {decision['move']:<54} → {decision['action']:<10} "
                      f"(conf {decision['confidence']:.2f}, {decision['ms']} ms)")
    except ModelError as failure:                    # no key, model not reachable, …
        print(f"The decision model did not answer: {str(failure)[:300]}")
        print("Run `python3 scripts/check_setup.py` to see what is missing.")
        return 1
    except Exception as failure:
        print(f"The run stopped: {str(failure)[:300]}")
        return 1

    state = (await runner.session_service.get_session(
        app_name="fight_loop", user_id="you", session_id=session.id)).state
    ticks = state.get("tick", 0)
    print(f"report  {ticks} of {len(MOVES)} moves played")
    if ticks < len(MOVES):
        print("        The loop stopped early. Check the routes tick returns.")
    return 0


if __name__ == "__main__":
    warnings.filterwarnings("ignore")
    logging.disable(logging.CRITICAL)            # the script prints what matters
    sys.exit(asyncio.run(main()))
