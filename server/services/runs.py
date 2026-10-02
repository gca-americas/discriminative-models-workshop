"""Running an exercise command and streaming it to the page.

The safety model is simple and worth stating: the page cannot send a command.
It sends a step slug and a task id, and the server looks the command up in the
content. Whatever a browser asks for, the only things that can run are the
commands an author wrote into a step.yaml.

Cloud Shell sits behind a buffering proxy, so the stream opens with padding and
heartbeats, and the page re-fetches the whole log when a run ends rather than
trusting that every line arrived. Both of those are load-bearing.
"""

from __future__ import annotations

import asyncio
import os
import sys
import re
import shlex
import subprocess
import threading
import time
from typing import Any

from server import config

_subscribers: list[asyncio.Queue] = []
_loop: asyncio.AbstractEventLoop | None = None
_runs: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()


def bind_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def subscribe() -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.append(queue)
    return queue


def unsubscribe(queue: asyncio.Queue) -> None:
    if queue in _subscribers:
        _subscribers.remove(queue)


def publish(event: dict[str, Any]) -> None:
    """Called from the worker thread; hops onto the event loop to fan out."""
    if _loop is None:
        return
    for queue in list(_subscribers):
        _loop.call_soon_threadsafe(queue.put_nowait, event)


def _substitute(command: str, env: dict[str, str]) -> str:
    def one(match: re.Match[str]) -> str:
        return env.get(match.group(1) or match.group(2), "")

    return re.sub(r"\$\{(\w+)\}|\$(\w+)", one, command)


def log_path(token: str) -> "os.PathLike[str]":
    return config.RUNS / f"{token}.log"


def status(token: str) -> dict[str, Any] | None:
    with _lock:
        record = _runs.get(token)
        return dict(record) if record else None


def read_log(token: str) -> str:
    path = log_path(token)
    return path.read_text() if os.path.exists(path) else ""


def fill(command: str, env: dict[str, str]) -> str:
    """The command with its variables resolved -- what the student should be
    shown, rather than the template an author wrote."""
    return _substitute(command, env)


def start(slug: str, task_id: str, command: str, env: dict[str, str],
          process_env: dict[str, str | None] | None = None) -> str:
    """Spawn the task. Returns a token the page uses to follow and to settle up.

    The token exists because in Cloud Shell the browser and the server are
    different machines: comparing clocks to decide whether a run finished
    reports false endings, so every line and the exit record carry the token.
    """
    token = f"{slug}.{task_id}.{int(time.time() * 1000)}"
    filled = _substitute(command, env)

    with _lock:
        _runs[token] = {"token": token, "slug": slug, "task": task_id,
                        "command": filled, "state": "running", "code": None}

    thread = threading.Thread(target=_pump, args=(token, filled, process_env), daemon=True)
    thread.start()
    return token


def _pump(token: str, command: str, process_env: dict[str, str | None] | None = None) -> None:
    path = log_path(token)
    publish({"type": "run.start", "token": token, "command": command})

    with open(path, "w", encoding="utf-8") as sink:
        sink.write(f"$ {command}\n")
        sink.flush()
        publish({"type": "run.line", "token": token, "line": f"$ {command}"})

        try:
            from server.services import environment  # late: avoids a cycle

            argv = shlex.split(command)
            # The workshop's scripts need the workshop's packages, so `python3`
            # in a content file means the interpreter this server runs on.
            if argv and argv[0] in {"python3", "python"}:
                argv[0] = sys.executable
            proc = subprocess.Popen(
                argv,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=config.ROOT,
                env=_with(environment.script_env(), process_env),
            )
        except FileNotFoundError as missing:
            line = f"not found: {missing}"
            sink.write(line + "\n")
            publish({"type": "run.line", "token": token, "line": line})
            _finish(token, 127)
            return

        assert proc.stdout is not None
        for line in proc.stdout:
            line = line.rstrip("\n")
            sink.write(line + "\n")
            sink.flush()
            publish({"type": "run.line", "token": token, "line": line})

        code = proc.wait()

    _finish(token, code)


def _with(env: dict[str, str], changes: dict[str, str | None] | None) -> dict[str, str]:
    """The environment with a few variables set, or removed where the value is
    None. A secret travels this way rather than on the command line, so it is
    never shown or written to the run's log."""
    env = dict(env)
    for key, value in (changes or {}).items():
        if value is None:
            env.pop(key, None)
        else:
            env[key] = value
    return env


def _finish(token: str, code: int) -> None:
    with _lock:
        if token in _runs:
            _runs[token].update(state="done", code=code)
    publish({"type": "run.done", "token": token, "code": code})
