"""The fast branch on its own: the Discriminative model decides, once per tick, in a loop.

    python3 branches/fast_branch.py

A small ADK workflow of two nodes, with nothing from the arena:

    START ─► tick ─"next"─► tick ─► … ─"done"─► report

Each tick takes the next move from MOVES, asks the Discriminative model which
response is right, and picks the edge to take next: "next" loops back to
tick, "done" ends the loop after the last move. The decision for each tick is
written to state, so report can read them all.

tick starts unassembled, marked TODO. Step 6b assembles it.
Needs the Discriminative model: Jev, DiffusionGemma or rehearsal mode (see step 2).
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
import warnings
from pathlib import Path

from google.adk.agents.context import Context
from google.adk.events.event import Event
from google.adk.runners import InMemoryRunner
from google.adk.workflow import Workflow
from google.genai import types
from typesafe_sdk import AsyncTypeSafeClient, Choice

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
    name="fast_branch",
    description="The Discriminative model decides once per tick, in a loop.",
    edges=[
        ("START", tick),
        (tick, {"next": tick, "done": report}),
    ],
)


# ── running it from the terminal ─────────────────────────────────────────────

def load_env() -> None:
    env = Path(__file__).resolve().parent.parent / ".env"
    if env.is_file():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def client_kwargs() -> dict:
    """Where the model is: TypeSafe by default, or the address in .env (DiffusionGemma,
    rehearsal mode). A local server ignores the key, but the SDK wants one."""
    base = os.environ.get("TYPESAFE_BASE_URL", "")
    key = os.environ.get("TYPESAFE_API_KEY") or ("local" if base else "")
    return {"api_key": key, **({"base_url": base} if base else {}), "timeout": 60}


async def main() -> int:
    load_env()
    if not (os.environ.get("TYPESAFE_API_KEY") or os.environ.get("TYPESAFE_BASE_URL")):
        print("The Discriminative model is not set up. See step 2.")
        return 2

    runner = InMemoryRunner(agent=root_agent, app_name="fast_branch")
    session = await runner.session_service.create_session(app_name="fast_branch", user_id="you")
    message = types.Content(role="user", parts=[types.Part(text="go")])
    try:
        async for event in runner.run_async(user_id="you", session_id=session.id, new_message=message):
            decision = event.output if isinstance(event.output, dict) and "move" in event.output else None
            if decision:
                print(f"tick {decision['tick']}  {decision['move']:<54} → {decision['action']:<10} "
                      f"(conf {decision['confidence']:.2f}, {decision['ms']} ms)")
    except Exception as failure:                     # no key, model not reachable, …
        print(f"The run stopped: {str(failure)[:300]}")
        return 1

    state = (await runner.session_service.get_session(
        app_name="fast_branch", user_id="you", session_id=session.id)).state
    ticks = state.get("tick", 0)
    print(f"report  {ticks} of {len(MOVES)} moves played")
    if ticks < len(MOVES):
        print("        The loop stopped early. Check the routes tick returns.")
    return 0


if __name__ == "__main__":
    warnings.filterwarnings("ignore")
    logging.disable(logging.CRITICAL)            # the script prints what matters
    sys.exit(asyncio.run(main()))
