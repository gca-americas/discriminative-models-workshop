"""The first call: one telegraph, two questions (a choice and a yes/no), and what comes back.

Run it:            python3 scripts/first_call.py
See it as curl:    python3 scripts/first_call.py --curl

TELEGRAPH and REQUEST start with two parts missing, marked TODO. Step 5a fills them in.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from jev_common import cost_line, load_env, jev_client  # noqa: E402

TELEGRAPH = ""  # TODO: TELEGRAPH - what the ogre just did, assembled in step 5a

# The five responses, and when each one is right. A choice question's criteria.
RESPONSES = {
    "block_high": "Raise the shield against a high swing.",
    "block_low": "Drop the shield against a swing at the legs.",
    "dodge": "Step aside from a charge or a thrown object.",
    "strike": "Attack now, while the opponent is exposed.",
    "wait": "Hold and watch, against a feint.",
}

# The request, as JSON. This is the whole API: some state, some questions.
REQUEST = {
    "state": {
        "opponent": "a nine-foot ogre with a spiked club, thick hide, and a short temper",
        "telegraph": TELEGRAPH,
    },
    "model": "jev-latest",
    "questions": {
        # TODO: RESPONSE - add "response": a choice question with RESPONSES as its criteria
        "exposed": {
            "type": "noul",
            "instructions": "Is the opponent exposed to a counter-attack right now?",
        },
    },
}


def as_curl() -> str:
    base = os.environ.get("TYPESAFE_BASE_URL", "https://api.typesafe.ai")
    body = json.dumps(REQUEST, indent=2)
    return (f"curl -X POST {base}/v1/systemone \\\n"
            f"  -H \"Authorization: Bearer $TYPESAFE_API_KEY\" \\\n"
            f"  -H \"Content-Type: application/json\" \\\n"
            f"  -d '{body}'")


def questions_for_sdk(questions: dict) -> dict:
    """The JSON questions, as the SDK's question objects."""
    from typesafe_sdk import Choice, Noul, Score

    built = {}
    for name, question in questions.items():
        kind = question.get("type")
        if kind == "choice":
            built[name] = Choice(instructions=question["instructions"], criteria=question["criteria"])
        elif kind == "score":
            built[name] = Score(instructions=question["instructions"], criteria=question["criteria"])
        else:
            built[name] = Noul(instructions=question["instructions"])
    return built


def main() -> int:
    load_env()
    if "--curl" in sys.argv:
        print(as_curl())
        return 0

    from typesafe_sdk import TypeSafeError

    print("request")
    print(json.dumps(REQUEST, indent=2))
    print()
    if not TELEGRAPH.strip():
        print("TELEGRAPH is empty. Describe what the ogre just did (step 5a), save, and run this again.")
        return 1
    if "response" not in REQUEST["questions"]:
        print("note: REQUEST has no response question yet. Add it in step 5a to get a response back.")

    started = time.perf_counter()
    try:
        with jev_client() as client:
            response = client.system_one(state=REQUEST["state"],
                                         questions=questions_for_sdk(REQUEST["questions"]))
    except (TypeSafeError, KeyError) as failure:
        print(f"The Discriminative model did not answer: {failure}")
        print("Run `python3 scripts/check_setup.py` to see what is missing.")
        return 1
    elapsed_ms = round((time.perf_counter() - started) * 1000)

    print("response")
    print(json.dumps(response.model_dump(mode="json"), indent=2))
    print()
    for name, answer in response.choices.items():
        print(f"{name} → {answer.choice}   (confidence {answer.confidence:.2f})")
    for name, answer in response.scores.items():
        print(f"{name} → {answer.score:.2f}   (confidence {answer.confidence:.2f})")
    for name, answer in response.nouls.items():
        print(f"{name} → {answer.noul:.2f}   (probability that the answer is yes)")
    print(f"{elapsed_ms} ms · {cost_line(response)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
