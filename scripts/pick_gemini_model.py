"""Find a Gemini model this project can call, and print its name.

    python3 scripts/pick_gemini_model.py

It tries the model already configured (JEV101_GEMINI_MODEL, or gemini-flash-latest)
with one tiny request. If that model is not available to the key, it lists the
models the key can see and tries the newest plain Flash model, then the next.

Uses the same settings as the workshop: GEMINI_API_KEY in .env at the root.
setup_codelab.sh saves the result as JEV101_GEMINI_MODEL. This is the model
that writes the tale in step 6; the spell card is read by gemini-decision-1.

Exit codes: 0 found one (its name on stdout), 1 none worked, 2 Gemini not set up.
"""

from __future__ import annotations

import logging
import os
import re
import sys
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT = "gemini-flash-latest"
FLASH = re.compile(r"^gemini-(\d+(?:\.\d+)?)-flash$")      # plain Flash: no lite, image, tts, preview


def load_env() -> None:
    env = ROOT / ".env"
    if env.is_file():
        for line in env.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def client():
    from google import genai

    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    return genai.Client(vertexai=False, api_key=key) if key else None


def answers(gemini, model: str) -> str:
    """Empty when the model answered; otherwise why it did not."""
    try:
        gemini.models.generate_content(model=model, contents="Reply with one word: ready")
        return ""
    except Exception as failure:                   # not found, no access, quota, …
        return str(failure)[:300] or type(failure).__name__


def candidates(gemini) -> list[str]:
    names = []
    for found in gemini.models.list():
        name = found.name.rsplit("/", 1)[-1]
        match = FLASH.match(name)
        if match:
            names.append((float(match.group(1)), name))
    return [name for _, name in sorted(names, reverse=True)]


def main() -> int:
    warnings.filterwarnings("ignore")
    logging.disable(logging.CRITICAL)
    load_env()
    gemini = client()
    if gemini is None:
        print("There is no GEMINI_API_KEY. Add one in step 2.", file=sys.stderr)
        return 2

    configured = os.environ.get("JEV101_GEMINI_MODEL") or DEFAULT
    why = answers(gemini, configured)
    if not why:
        print(configured)
        return 0
    if "PERMISSION_DENIED" in why or "403" in why[:20]:
        # No access is not a missing model: another model will not answer either.
        print(f"Gemini refused the call: {why}", file=sys.stderr)
        return 1
    print(f"{configured} is not available here; looking for another Flash model.", file=sys.stderr)
    try:
        options = candidates(gemini)
    except Exception as failure:
        print(f"Could not list the models: {str(failure)[:200]}", file=sys.stderr)
        return 1
    for name in options:
        if not answers(gemini, name):
            print(name)
            return 0
    print("No Flash model answered. Check the key's access to Gemini.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
