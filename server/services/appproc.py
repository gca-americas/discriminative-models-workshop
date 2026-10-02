"""The student's app, as a service the workbench can start, stop and show.

The app is a separate process, exactly as it would be in a terminal -- the
workbench does not import it or run it in-process. What the workbench adds is a
reverse proxy at /app, so the page can embed the running app in an iframe.

Proxying rather than framing http://localhost:8080 directly buys two things:

  * the frame is same-origin, so no X-Frame-Options negotiation
  * behind a proxy such as Cloud Shell's, only one port needs opening

For that to work the app's own HTML asks for relative URLs (game.js, not
/game.js), so it is served correctly both here under /app/ and on its own.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from typing import Any

from server import config

APP_DIR = config.ROOT / "app"
VENV_PYTHON = APP_DIR / ".venv" / "bin" / "python"
APP_PORT = int(os.environ.get("JEV101_APP_PORT", "8090"))
ORIGIN = f"http://127.0.0.1:{APP_PORT}"

_process: subprocess.Popen | None = None


def _log_path():
    return config.RUNS / "app.log"


def _pid_path():
    return config.RUNS / "app.pid"


def _recorded_pid() -> int | None:
    """The app's process id, written when it starts.

    Kept on disk rather than only in memory so the workbench can still stop an
    app it started before its own last restart.
    """
    try:
        pid = int(_pid_path().read_text().strip())
    except (OSError, ValueError):
        return None
    try:
        os.kill(pid, 0)          # signal 0 asks "is it there?" and changes nothing
    except OSError:
        return None
    return pid


def alive() -> bool:
    """Is anything answering on the app's port? Deliberately not 'did we start
    it' -- a student who ran `python3 app/main.py` in a terminal should see the
    workbench notice."""
    try:
        with urllib.request.urlopen(f"{ORIGIN}/api/health", timeout=1.5) as response:
            return response.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def status() -> dict[str, Any]:
    running = alive()
    ours = (_process is not None and _process.poll() is None) or _recorded_pid() is not None
    return {
        "running": running,
        "managed": ours,
        "port": APP_PORT,
        "url": "/app/",
        "log": _log_path().name if ours else None,
    }


def start() -> dict[str, Any]:
    global _process

    if alive():
        return {**status(), "detail": "already running"}

    from server.services import environment

    log = open(_log_path(), "w", encoding="utf-8")
    # The app needs the TypeSafe SDK, which the workbench's own interpreter has.
    # An app/.venv, if someone makes one, wins.
    python = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable
    _process = subprocess.Popen(
        [python, "main.py"],
        cwd=APP_DIR,
        stdout=log,
        stderr=subprocess.STDOUT,
        env={**environment.script_env(), "PORT": str(APP_PORT)},
        start_new_session=True,
    )
    _pid_path().write_text(str(_process.pid))

    # Give it a moment to bind, so the page does not flash "not running".
    for _ in range(20):
        if alive():
            break
        try:
            _process.wait(timeout=0.25)
            break  # it exited; the log says why
        except subprocess.TimeoutExpired:
            continue

    return {**status(), "detail": "started" if alive() else "did not start"}


def _end(pid: int) -> None:
    """Stop the app and everything it started. It runs in its own session, so
    the whole group goes."""
    try:
        group = os.getpgid(pid)
    except OSError:
        return
    os.killpg(group, signal.SIGTERM)
    for _ in range(20):
        try:
            os.killpg(group, 0)
        except OSError:
            return
        time.sleep(0.25)
    try:
        os.killpg(group, signal.SIGKILL)
    except OSError:
        pass


def stop() -> dict[str, Any]:
    global _process

    pid = None
    if _process is not None and _process.poll() is None:
        pid = _process.pid
    else:
        pid = _recorded_pid()

    if pid is not None:
        _end(pid)
        _process = None
        _pid_path().unlink(missing_ok=True)
        return {**status(), "detail": "stopped"}

    if alive():
        # Something else is on the port -- say so rather than pretending.
        return {**status(), "detail": "running, but not started by the workbench"}

    _pid_path().unlink(missing_ok=True)
    return {**status(), "detail": "was not running"}


def read_log(limit: int = 4000) -> str:
    path = _log_path()
    return path.read_text()[-limit:] if path.exists() else ""


HOP_BY_HOP = {"connection", "keep-alive", "transfer-encoding", "upgrade",
              "proxy-authenticate", "proxy-authorization", "te", "trailer"}


def proxy(path: str, method: str, body: bytes | None,
          headers: dict[str, str]) -> tuple[int, bytes, dict[str, str]]:
    """Pass one request through to the app and hand back what it said."""
    request = urllib.request.Request(
        f"{ORIGIN}/{path.lstrip('/')}",
        data=body if method == "POST" else None,
        method=method,
    )
    lowered = {k.lower(): v for k, v in headers.items()}
    for name in ("content-type", "accept", "range"):
        if name in lowered:
            request.add_header(name, lowered[name])

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = response.read()
            passed = {k: v for k, v in response.headers.items()
                      if k.lower() not in HOP_BY_HOP}
            return response.status, payload, passed
    except urllib.error.HTTPError as failure:
        return failure.code, failure.read(), {"Content-Type": "text/plain"}
    except (urllib.error.URLError, TimeoutError, OSError):
        return 503, b"the app is not running", {"Content-Type": "text/plain"}
