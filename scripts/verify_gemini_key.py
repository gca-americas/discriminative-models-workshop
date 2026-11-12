"""Check a Gemini API key with one real request to the Decisions API.

    GEMINI_API_KEY=... python3 scripts/verify_gemini_key.py

The key comes from the environment, or from .env at the root of the workshop,
never from the command line, so it does not show up in the process list.

Exit codes:
    0   the key works
    1   Google refused the key, or the key cannot call gemini-decision-1
    2   the API could not be reached, or there is no key to check
"""

from __future__ import annotations

import hashlib
import os
import sys
import time
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VERIFIED = ROOT / "runs" / "gemini-verified"      # a hash of the last key that worked
KEYS_PAGE = "https://aistudio.google.com/apikey"


def fingerprint(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def key_from_env_file() -> str:
    env = ROOT / ".env"
    if not env.is_file():
        return ""
    for line in env.read_text().splitlines():
        if line.strip().startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def main() -> int:
    warnings.filterwarnings("ignore")
    key = os.environ.get("GEMINI_API_KEY") or key_from_env_file()
    if not key:
        print("no Gemini API key to check")
        return 2

    from google import genai

    client = genai.Client(vertexai=False, api_key=key,
                          http_options={"api_version": "v1beta", "timeout": 20_000})
    started = time.perf_counter()
    try:
        client.decisions.create(
            model="gemini-decision-1",
            input="The ogre raises its club high over its head.",
            questions={"attack": {"type": "noul", "instructions": "Is the opponent about to attack?"}},
        )
    except Exception as failure:
        status = getattr(failure, "code", None) or getattr(failure, "status_code", None)
        text = str(getattr(failure, "message", None) or failure).strip().splitlines()[0][:240]
        if status in (400, 401, 403):
            print("Google refused this key. Check it, or create a new one, at")
            print(f"  {KEYS_PAGE}")
            print(f"  ({text})")
            return 1
        if status is None:
            print("could not reach generativelanguage.googleapis.com. Check the network and try again.")
            return 2
        print(f"The Decisions API answered with an error: {status} {text}")
        return 1

    VERIFIED.parent.mkdir(exist_ok=True)
    VERIFIED.write_text(fingerprint(key))
    ms = round((time.perf_counter() - started) * 1000)
    print(f"key works · gemini-decision-1 answered in {ms} ms")
    return 0


if __name__ == "__main__":
    sys.exit(main())
