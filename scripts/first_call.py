"""The first call: one telegraph, two questions (a choice and a yes/no), and what comes back.

Run it:            python3 scripts/first_call.py
See it as curl:    python3 scripts/first_call.py --curl

TELEGRAPH and QUESTIONS start with two parts missing, marked TODO. Step 5a fills them in.

The request goes to the model you chose in step 2. ask(), from
scripts/decisions.py, sends it with the TypeSafe SDK (Jev, DiffusionGemma) or
the Google Gen AI SDK (Gemini Decisions). The two APIs name one field
differently: what the model judges is `state` in one and `input` in the other.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from jev_common import cost_line, jev_backend, load_env  # noqa: E402

TELEGRAPH = ""  # TODO: TELEGRAPH - what the ogre just did, assembled in step 5a

# The five responses, and when each one is right. A choice question's criteria.
RESPONSES = {
    "block_high": "Raise the shield against a high swing.",
    "block_low": "Drop the shield against a swing at the legs.",
    "dodge": "Step aside from a charge or a thrown object.",
    "strike": "Attack now, while the opponent is exposed.",
    "wait": "Hold and watch, against a feint.",
}

# What the model judges: the situation, in plain data.
SITUATION = {
    "opponent": "a nine-foot ogre with a spiked club, thick hide, and a short temper",
    "telegraph": TELEGRAPH,
}

# The questions about it. Each has a name, a type and instructions.
QUESTIONS = {
    # TODO: RESPONSE - add "response": a choice question with RESPONSES as its criteria
    "exposed": {
        "type": "noul",
        "instructions": "Is the opponent exposed to a counter-attack right now?",
    },
}


def as_sent(backend: str) -> tuple[str, str, dict]:
    """The request as it goes out to your model: the URL, the key header and
    the JSON body. The two APIs differ in those three places; the questions
    are the same."""
    if backend == "gemini":
        return ("https://generativelanguage.googleapis.com/v1beta/decisions", "x-goog-api-key: $GEMINI_API_KEY",
                {"model": "gemini-decision-1", "input": json.dumps(SITUATION), "questions": QUESTIONS})
    base = os.environ.get("TYPESAFE_BASE_URL") or "https://api.typesafe.ai"
    return (f"{base}/v1/systemone", "Authorization: Bearer $TYPESAFE_API_KEY",
            {"model": "jev-latest", "state": SITUATION, "questions": QUESTIONS})


def as_curl(backend: str) -> str:
    url, header, body = as_sent(backend)
    return (f"curl -X POST {url} \\\n"
            f"  -H \"{header}\" \\\n"
            f"  -H \"Content-Type: application/json\" \\\n"
            f"  -d '{json.dumps(body, indent=2)}'")


def main() -> int:
    load_env()
    backend = jev_backend()
    if "--curl" in sys.argv:
        print(as_curl(backend))
        return 0

    from decisions import ModelError, ask

    url, _, body = as_sent(backend)
    print(f"request   POST {url}")
    print(json.dumps(body, indent=2))
    print()
    if not TELEGRAPH.strip():
        print("TELEGRAPH is empty. Describe what the ogre just did (step 5a), save, and run this again.")
        return 1
    if "response" not in QUESTIONS:
        print("note: QUESTIONS has no response question yet. Add it in step 5a to get a response back.")

    started = time.perf_counter()
    try:
        answered = ask(about=SITUATION, questions=QUESTIONS)
    except (ModelError, KeyError) as failure:
        print(f"The Discriminative model did not answer: {failure}")
        print("Run `python3 scripts/check_setup.py` to see what is missing.")
        return 1
    elapsed_ms = round((time.perf_counter() - started) * 1000)

    print("response")
    print(json.dumps({"answers": answered.dump(), "model": answered.model,
                      "usage": {"input_tokens": answered.input_tokens, "output_tokens": 0}}, indent=2))
    print()
    for name, answer in answered.answers.items():
        kind = QUESTIONS[name]["type"]
        if kind == "choice":
            print(f"{name} → {answer.choice}   (confidence {answer.confidence:.2f})")
        elif kind == "score":
            print(f"{name} → {answer.score:.2f}   (confidence {answer.confidence:.2f})")
        else:
            print(f"{name} → {answer.noul:.2f}   (probability that the answer is yes)")
    print(f"{elapsed_ms} ms · {cost_line(answered)}")
    print("Add --curl to see this request as a curl command.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
