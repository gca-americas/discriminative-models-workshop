"""What the workbench knows about the student's setup.

Two keys matter in this workshop: one for the Discriminative model (TypeSafe) and one for Gemini.
They are read from the process environment and from a `.env` file at the root
of the workshop, the same file the scripts and the app read, so setting a key
once is enough. Nothing here is configured by hand beyond that.

Discriminative model calls can also go to a self-hosted, Discriminative-model-compatible server such as
OpenJev on DiffusionGemma: set TYPESAFE_BASE_URL to it in `.env`.

There is also a rehearsal mode. `JEV101_REHEARSAL=1` points every script at a
small local stand-in for the Discriminative model API (scripts/fake_jev.py), so the workshop can
be walked through on a plane. The page says so when it is on.
"""

from __future__ import annotations

import hashlib
import os
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from server import config

ENV_FILE = config.ROOT / ".env"
FAKE_JEV_PORT = int(os.environ.get("JEV101_FAKE_PORT", "4811"))
FAKE_JEV_URL = f"http://127.0.0.1:{FAKE_JEV_PORT}"

_CACHE: dict[str, Any] = {"at": 0.0, "value": None}
VERIFIED = config.ROOT / "runs" / "jev-verified"   # written by scripts/verify_jev_key.py
_verifying: set[str] = set()                        # key hashes being checked now
MODEL_SETUP: dict[str, str] = {}                    # the step 2 run: {"token", "model"}
_TTL = 5.0


_FROM_FILE: dict[str, str] = {}      # what .env last set, so a later edit replaces it


def load_dotenv(path: Path = ENV_FILE) -> None:
    """Read KEY=value lines into the environment without overriding anything
    set before the workbench started. Cheap, so it runs on every discovery: a
    student who writes the file, or switches the model in step 2, should not
    have to restart. A value .env set earlier follows the file, and goes when
    its line goes."""
    values: dict[str, str] = {}
    if path.is_file():
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip('"').strip("'")
    ours = {key: value for key, value in _FROM_FILE.items() if os.environ.get(key) == value}
    for key in ours:
        if key not in values:
            os.environ.pop(key, None)
    _FROM_FILE.clear()
    for key, value in values.items():
        if key not in os.environ or key in ours:
            os.environ[key] = value
            _FROM_FILE[key] = value


def rehearsal() -> bool:
    return os.environ.get("JEV101_REHEARSAL", "") not in ("", "0", "false")


def _answers(url: str, timeout: float = 1.0) -> bool:
    try:
        with urllib.request.urlopen(f"{url}/health", timeout=timeout) as response:
            return response.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def _jev_verified(key: str) -> bool:
    """Whether this key has answered a real request. A key nobody has checked
    yet (written into .env by hand, say) is checked once, in the background."""
    digest = hashlib.sha256(key.encode()).hexdigest()
    try:
        if VERIFIED.read_text().strip() == digest:
            return True
    except OSError:
        pass
    if digest not in _verifying:
        _verifying.add(digest)
        env = {**os.environ, "TYPESAFE_API_KEY": key}
        threading.Thread(target=_verify, args=(env,), daemon=True).start()
    return False


def _verify(env: dict[str, str]) -> None:
    subprocess.run([sys.executable, str(config.ROOT / "scripts" / "verify_jev_key.py")],
                   env=env, stdin=subprocess.DEVNULL, capture_output=True, timeout=60)
    _CACHE["value"] = None


# A model server's health, looked up in the background: through the IAP tunnel
# one look can take several seconds, too long to hold up a page.
_HEALTH: dict[str, Any] = {"url": "", "ok": False, "at": 0.0, "busy": False}
_HEALTH_TTL = 20.0
_HEALTH_TIMEOUT = 15.0


def _look(url: str) -> None:
    ok = _answers(url, _HEALTH_TIMEOUT)
    _HEALTH.update(url=url, ok=ok, at=time.time(), busy=False)
    _CACHE["value"] = None


def _server_ready(url: str, wait: bool = False) -> bool:
    if wait:
        _look(url)
        return _HEALTH["ok"]
    fresh = _HEALTH["url"] == url and time.time() - _HEALTH["at"] < _HEALTH_TTL
    if not fresh and not _HEALTH["busy"]:
        _HEALTH["busy"] = True
        threading.Thread(target=_look, args=(url,), daemon=True).start()
    return _HEALTH["ok"] if _HEALTH["url"] == url else False


def check_server_now() -> None:
    """Look at the model server now, and wait for the answer."""
    base = os.environ.get("TYPESAFE_BASE_URL", "").rstrip("/")
    if base:
        _server_ready(base, wait=True)


def verify_jev_now() -> None:
    """Check the Jev key now, and wait for the answer."""
    _verify({**os.environ})


def _setting_up() -> str:
    from server.services import runs   # late: runs imports this module
    token = MODEL_SETUP.get("token")
    record = runs.status(token) if token else None
    return MODEL_SETUP.get("model", "") if record and record["state"] == "running" else ""


def discover(force: bool = False) -> dict[str, Any]:
    now = time.time()
    if not force and _CACHE["value"] is not None and now - _CACHE["at"] < _TTL:
        return _CACHE["value"]

    load_dotenv()
    jev_key = bool(os.environ.get("TYPESAFE_API_KEY"))
    gemini_key = bool(os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"))
    vertex = os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in ("1", "true") \
        and bool(os.environ.get("GOOGLE_CLOUD_PROJECT"))

    base = os.environ.get("TYPESAFE_BASE_URL", "")
    if rehearsal():
        jev_mode = "rehearsal" if _answers(FAKE_JEV_URL) else "rehearsal (stand-in not running)"
    elif base and os.environ.get("JEV101_GEMMA_VM"):
        jev_mode = "gemma on vm"            # DiffusionGemma, deployed by scripts/setup_gemma.sh
    elif base and ".run.app" in base:
        jev_mode = "gemma on cloud run"     # DiffusionGemma, deployed by scripts/setup_gemma.sh
    elif base and "api.typesafe.ai" not in base:
        jev_mode = "self-hosted"            # e.g. OpenJev on DiffusionGemma
    else:
        jev_mode = "live" if jev_key else "no key"

    # Green means checked and answering: rehearsal always, a model server when
    # its health check answers, Jev once the key has answered a real request.
    if rehearsal():
        ready = True
    elif jev_mode == "live":
        ready = _jev_verified(os.environ["TYPESAFE_API_KEY"])
    elif jev_mode == "no key":
        ready = False
    else:
        ready = _server_ready(base.rstrip("/"))

    value = {
        "jev": jev_mode,
        "jevKey": jev_key,
        "modelReady": ready,
        "modelSetup": _setting_up(),
        "rehearsal": rehearsal(),
        "gemini": "vertex" if vertex else "api key" if gemini_key else "no key",
        "geminiReady": vertex or gemini_key,
        "model": os.environ.get("TYPESAFE_DEFAULT_MODEL", "jev-latest"),
        "project": os.environ.get("GOOGLE_CLOUD_PROJECT", ""),
        "envFile": str(ENV_FILE.relative_to(config.ROOT)) if ENV_FILE.is_file() else "",
    }
    _CACHE.update(at=now, value=value)
    return value


def as_substitutions() -> dict[str, str]:
    """The variables a probe or a task command may reference."""
    env = discover()
    return {
        "HOME": str(Path.home()),
        "ROOT": str(config.ROOT),
        "JEV_MODEL": env["model"],
        "JEV_MODE": env["jev"],
        "APP_PORT": os.environ.get("JEV101_APP_PORT", "8090"),
        "FAKE_JEV_URL": FAKE_JEV_URL,
    }


def script_env() -> dict[str, str]:
    """The environment a script, probe or the app runs with. In rehearsal mode
    the SDK is pointed at the local stand-in through the variable it already
    honours, so no script has to know the mode exists."""
    load_dotenv()
    env = {**os.environ, "PYTHONUNBUFFERED": "1"}
    if rehearsal():
        env["TYPESAFE_BASE_URL"] = FAKE_JEV_URL
        env.setdefault("TYPESAFE_API_KEY", "rehearsal")
    elif env.get("TYPESAFE_BASE_URL") and "api.typesafe.ai" not in env["TYPESAFE_BASE_URL"] \
            and ".run.app" not in env["TYPESAFE_BASE_URL"]:
        env.setdefault("TYPESAFE_API_KEY", "self-hosted")   # the SDK wants one; the server ignores it
    # A Cloud Run model needs a Google identity token; each process fetches
    # its own through scripts/jevauth.py, so it can refresh it as it goes.
    return env
