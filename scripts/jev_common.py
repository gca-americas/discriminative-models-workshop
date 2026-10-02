"""Small things every script needs: the .env file, the inbox, and a cost line.
Not a script to run; the others import it."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PRICE_PER_MILLION_INPUT_TOKENS = 0.042   # the Discriminative model's published price; output tokens are free


def load_env(path: Path = ROOT / ".env") -> None:
    """KEY=value lines, without overriding what the shell already set."""
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def jev_backend(base_url: str | None = None) -> str:
    """typesafe | cloud-run | self-hosted | rehearsal: see scripts/jevauth.py."""
    return _jevauth().backend(base_url)


def jev_client():
    """A TypeSafeClient for whichever backend .env points at, authorised."""
    from typesafe_sdk import TypeSafeClient

    auth = _jevauth()
    auth.prepare()
    return TypeSafeClient(**auth.client_kwargs())


def _jevauth():
    import jevauth  # noqa: E402  (scripts/jevauth.py, next to this file)
    return jevauth


def moves() -> list[dict]:
    """The ogre's telegraphs, numbered from 1, straight from the engine."""
    import sys
    sys.path.insert(0, str(ROOT / "app"))
    import engine  # noqa: E402
    return [{**move, "id": i + 1} for i, move in enumerate(engine.MOVES)]


def opponent() -> dict:
    import sys
    sys.path.insert(0, str(ROOT / "app"))
    import engine  # noqa: E402
    return engine.OPPONENT


def cost_line(response) -> str:
    tokens = response.usage.input_tokens or 0
    return (f"{tokens} input tokens · ${tokens * PRICE_PER_MILLION_INPUT_TOKENS / 1_000_000:.6f}"
            f" · model {response.model}")


def bar(value: float, width: int = 20) -> str:
    filled = round(max(0.0, min(1.0, value)) * width)
    return "█" * filled + "·" * (width - filled)
