"""Paths, ports, and the handful of environment values the workbench reads."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
STEPS = CONTENT / "steps"
WEB_DIST = ROOT / "web" / "dist"
RUNS = ROOT / "runs"

PORT = int(os.environ.get("JEV101_PORT", "4900"))

RUNS.mkdir(exist_ok=True)
