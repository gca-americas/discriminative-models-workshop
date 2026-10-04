"""Find a Gemini model this project can call, and print its name.

    python3 scripts/pick_gemini_model.py

It tries the model already configured (JEV101_GEMINI_MODEL, or gemini-flash-latest)
with one tiny request. If that model is not available, for example a project on
Vertex AI that does not have the "-latest" alias, it lists the models the
project can see and tries the newest plain Flash model, then the next.

Uses the same settings as the workshop: .env at the root, Vertex AI when
GOOGLE_GENAI_USE_VERTEXAI=1 (with GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION),
otherwise an AI Studio key. setup.sh saves the result as JEV101_GEMINI_MODEL.

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

    if os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in ("1", "true"):
        return genai.Client(vertexai=True, project=os.environ.get("GOOGLE_CLOUD_PROJECT"),
                            location=os.environ.get("GOOGLE_CLOUD_LOCATION", "global"))
    key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    return genai.Client(api_key=key) if key else None


def answers(gemini, model: str) -> bool:
    try:
        gemini.models.generate_content(model=model, contents="Reply with one word: ready")
        return True
    except Exception:                              # not found, no access, quota, …
        return False


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
        print("Gemini is not set up: no Vertex AI project and no AI Studio key.", file=sys.stderr)
        return 2

    configured = os.environ.get("JEV101_GEMINI_MODEL") or DEFAULT
    if answers(gemini, configured):
        print(configured)
        return 0
    print(f"{configured} is not available here; looking for another Flash model.", file=sys.stderr)
    try:
        options = candidates(gemini)
    except Exception as failure:
        print(f"Could not list the models: {str(failure)[:200]}", file=sys.stderr)
        return 1
    for name in options:
        if answers(gemini, name):
            print(name)
            return 0
    print("No Flash model answered. Check the project's access to Gemini.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
