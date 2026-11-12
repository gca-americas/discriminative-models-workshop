"""Plugin: the Discriminative model fights. Added in step 5.

Each tick the page asks this server to respond, and the server asks the model
three questions about the move on screen in one call: which response, is the
ogre exposed, how much danger. reflex.choose() turns the answers into one
action; the game's rules (engine.py) resolve it.

The call itself is decisions.ask(), in scripts/decisions.py. It uses the
TypeSafe SDK for Jev and DiffusionGemma and the Google Gen AI SDK for Gemini
Decisions. Which one is set in .env, by step 2.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import engine
import reflex

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import decisions  # noqa: E402
import jevauth  # noqa: E402

MODE = "model"
LABEL = "Discriminative model fights"


def ask(arena, telegraph: str, spell_ready: bool) -> dict:
    """One call: what the ogre just did, three questions about it, typed answers back."""
    started = time.perf_counter()
    answered = decisions.ask(
        about={"opponent": engine.OPPONENT["description"], "telegraph": telegraph},
        questions=reflex.reflex_questions(spell_ready),
    )
    ms = round((time.perf_counter() - started) * 1000)
    arena.totals["calls"] += 1
    arena.totals["ms"] += ms
    arena.totals["tokens"] += answered.input_tokens
    return {
        "decision": reflex.choose(answered.answers, spell_ready),
        "answers": answered.dump(),
        "model": answered.model,
        "latencyMs": ms,
        "inputTokens": answered.input_tokens,
        "costUsd": answered.cost_usd,
    }


def respond(arena, body: dict):
    """The model decides the response to the move on screen."""
    try:
        asked = ask(arena, arena.pending["telegraph"], arena.fight.spell is not None)
    except decisions.ModelError as failure:
        if failure.status:
            return 502, {"error": f"The Discriminative model answered {failure.status}: {failure}"}
        return 502, {"error": f"could not reach the Discriminative model: {failure}"}
    entry = arena.fight.apply(arena.pending, asked["decision"])
    entry["latencyMs"] = asked["latencyMs"]
    arena.last = {**asked, "entry": entry, "totals": dict(arena.totals)}
    arena.pending = None
    return 200, {**asked, "entry": entry, "fight": arena.fight.snapshot(), "totals": arena.totals}


def health() -> dict:
    """What the page shows about the model: where it runs, and the thresholds."""
    backend = jevauth.backend()
    if backend == "gemini":
        base, has_key = "https://generativelanguage.googleapis.com", bool(decisions.gemini_key())
    else:
        base, has_key = os.environ.get("TYPESAFE_BASE_URL", "https://api.typesafe.ai"), bool(os.environ.get("TYPESAFE_API_KEY"))
    return {
        "hasKey": has_key,
        "backend": backend,
        "baseUrl": base,
        "pricePerMillion": decisions.price(backend),
        "thresholds": {"trustConfidence": reflex.TRUST_CONFIDENCE,
                       "heavyDanger": reflex.HEAVY_DANGER, "safeFallback": reflex.SAFE_FALLBACK},
    }


def describe() -> str:
    return f"Discriminative model calls go to {jevauth.describe()}"
