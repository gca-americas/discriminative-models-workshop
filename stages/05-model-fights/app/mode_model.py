"""Plugin: the Discriminative model fights. Added in step 5.

Each tick the page asks this server to respond, and the server asks the model
three questions about the move on screen in one call: which response, is the
ogre exposed, how much danger. reflex.choose() turns the answers into one
action; the game's rules (engine.py) resolve it.

The model is reached through the TypeSafe SDK. Where it lives (TypeSafe, your
DiffusionGemma VM, or the rehearsal stand-in) is set in .env; see
scripts/jevauth.py.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

from typesafe_sdk import TypeSafeAPIError, TypeSafeClient, TypeSafeError

import engine
import reflex

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import jevauth  # noqa: E402

MODE = "model"
LABEL = "Discriminative model fights"
PRICE_PER_MILLION_INPUT_TOKENS = 0.042   # published price; output is free


def ask(arena, telegraph: str, spell_ready: bool) -> dict:
    """One call: the telegraph as state, three questions, typed answers back."""
    jevauth.prepare()
    started = time.perf_counter()
    with TypeSafeClient(**jevauth.client_kwargs()) as client:
        response = client.system_one(
            state={"opponent": engine.OPPONENT["description"], "telegraph": telegraph},
            questions=reflex.reflex_questions(spell_ready),
        )
    ms = round((time.perf_counter() - started) * 1000)
    tokens = response.usage.input_tokens or 0
    arena.totals["calls"] += 1
    arena.totals["ms"] += ms
    arena.totals["tokens"] += tokens
    return {
        "decision": reflex.choose(response.answers, spell_ready),
        "answers": {name: answer.model_dump() for name, answer in response.answers.items()},
        "model": response.model,
        "latencyMs": ms,
        "inputTokens": tokens,
        "costUsd": tokens * PRICE_PER_MILLION_INPUT_TOKENS / 1_000_000,
    }


def respond(arena, body: dict):
    """The model decides the response to the move on screen."""
    try:
        asked = ask(arena, arena.pending["telegraph"], arena.fight.spell is not None)
    except TypeSafeAPIError as failure:
        return 502, {"error": f"The Discriminative model answered {failure.status}: {failure}"}
    except TypeSafeError as failure:
        return 502, {"error": f"could not reach the Discriminative model: {failure}"}
    entry = arena.fight.apply(arena.pending, asked["decision"])
    entry["latencyMs"] = asked["latencyMs"]
    arena.last = {**asked, "entry": entry, "totals": dict(arena.totals)}
    arena.pending = None
    return 200, {**asked, "entry": entry, "fight": arena.fight.snapshot(), "totals": arena.totals}


def health() -> dict:
    """What the page shows about the model: where it runs, and the thresholds."""
    base = os.environ.get("TYPESAFE_BASE_URL", "https://api.typesafe.ai")
    backend = jevauth.backend(base)
    return {
        "hasKey": bool(os.environ.get("TYPESAFE_API_KEY")),
        "backend": backend,
        "rehearsal": backend == "rehearsal",
        "baseUrl": base,
        "thresholds": {"trustConfidence": reflex.TRUST_CONFIDENCE,
                       "heavyDanger": reflex.HEAVY_DANGER, "safeFallback": reflex.SAFE_FALLBACK},
    }


def describe() -> str:
    return f"Discriminative model calls go to {jevauth.describe()}"
