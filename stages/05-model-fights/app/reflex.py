"""What the Discriminative model is asked every tick, and what the code does
with the answer.

Added in step 5, on top of the game from step 3. The rules stay in engine.py;
this file turns them into three typed questions, and turns the typed answers
back into one action. Used by the arena server (mode_model.py), the terminal
fight (scripts/fight.py) and the ADK workflow (agents/arena/agent.py).
"""

from __future__ import annotations

from typing import Any

from typesafe_sdk import Choice, Noul, Score

from engine import CAST, RESPONSES


# ── what the Discriminative model is asked, every tick ───────────────────────────────────────────

def reflex_questions(spell_ready: bool) -> dict[str, Any]:
    """The options change with the fight: `cast` is only offered when a spell
    is ready. Options are named at request time, so that costs nothing."""
    options = dict(RESPONSES)
    if spell_ready:
        options["cast"] = CAST
    return {
        "response": Choice(
            instructions="The opponent has just done this. What is the right response?",
            criteria=options,
        ),
        "exposed": Noul(
            instructions="Is the opponent exposed to a counter-attack right now?",
        ),
        "danger": Score(
            instructions="How much damage is about to land if the fighter does nothing?",
            criteria=["None: this is not an attack.", "A light hit.", "A heavy hit."],
        ),
    }


# ── thresholds: the numbers a person tunes ───────────────────────────────────

TRUST_CONFIDENCE = 0.40    # below this, the Discriminative model is guessing between responses
HEAVY_DANGER = 1.5         # score at or above this: play it safe when unsure
SAFE_FALLBACK = "dodge"    # what "play it safe" means here
SPEND_ON_OPENING = 0.60    # exposed at or above this, with a spell ready: cast, not strike


def choose(answers: dict[str, Any], spell_ready: bool) -> dict[str, Any]:
    """Typed answers in (`response.answers`), one action out. Two rules, both
    in code: a shaky choice in the face of a heavy hit becomes a dodge, and a
    strike into an opening becomes a cast when there is a spell to spend. The Discriminative model
    reads the situation; the code holds the policy."""
    response = answers["response"]
    exposed = answers["exposed"].noul
    danger = answers["danger"].score

    action = response.choice
    fallback = False
    if response.confidence < TRUST_CONFIDENCE and danger >= HEAVY_DANGER:
        action, fallback = SAFE_FALLBACK, True
    if spell_ready and action == "strike" and exposed >= SPEND_ON_OPENING:
        action = "cast"
    if action == "cast" and not spell_ready:
        action = "strike"

    return {
        "action": action,
        "confidence": round(response.confidence, 2),
        "probabilities": {k: round(v, 2) for k, v in response.probabilities.items()},
        "exposed": round(exposed, 2),
        "danger": round(danger, 2),
        "fallback": fallback,
    }
