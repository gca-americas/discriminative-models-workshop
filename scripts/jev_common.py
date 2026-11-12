"""Small things every script needs: the .env file, the inbox, and a cost line.
Not a script to run; the others import it."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


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
    """typesafe | gemma-vm | cloud-run | self-hosted | gemini: see scripts/jevauth.py."""
    return _jevauth().backend(base_url)


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


def cost_line(answered) -> str:
    """One line about a decisions.Answered: tokens, cost, model."""
    return (f"{answered.input_tokens} input tokens · ${answered.cost_usd:.6f} · "
            f"model {answered.model} · {answered.sdk}")


def bar(value: float, width: int = 20) -> str:
    filled = round(max(0.0, min(1.0, value)) * width)
    return "█" * filled + "·" * (width - filled)
