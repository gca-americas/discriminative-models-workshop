"""Looking around the project, and a small shell for doing it.

Two things share one set of path rules here:

  * the file explorer, which lists the tree and reads a file
  * the terminal, which accepts a handful of commands and runs them for real

Everything is confined to the repository, and the shell is an allowlist rather
than a shell: commands are matched and carried out in Python, never handed to
`sh`. A student can explore freely and cannot break anything or reach outside.
"""

from __future__ import annotations

import os
import re
import shlex
import subprocess
import time
import sys
from pathlib import Path
from typing import Any

from server import config
from server.services import appproc

ROOT = config.ROOT

# Noise a beginner should not have to look past.
# Folders whose Python files the terminal runs for real.
RUNNABLE = {ROOT / "scripts", ROOT / "branches"}
HIDDEN = {".venv", "node_modules", "__pycache__", ".git", "dist", "runs",
          ".pytest_cache", ".ruff_cache", "web/dist"}

TEXT_SUFFIXES = {".py", ".js", ".ts", ".tsx", ".css", ".html", ".md", ".yaml",
                 ".yml", ".json", ".sh", ".txt", ".toml", ".cfg", ""}

MAX_READ = 200_000


class OutsideWorkspace(Exception):
    """A path that resolves outside the project."""


def resolve(relative: str) -> Path:
    """A path inside the project, or an error. Symlinks are resolved first, so
    a link pointing outward is refused like any other outside path."""
    candidate = (ROOT / relative.strip().lstrip("/")).resolve()
    if candidate != ROOT and ROOT not in candidate.parents:
        raise OutsideWorkspace(relative)
    return candidate


def _hidden(path: Path) -> bool:
    name = path.name
    if name.startswith(".") and name not in {".env.example"}:
        return True
    return name in HIDDEN


def _display(cwd: Path) -> str:
    """What the prompt shows: ~/101 rather than a long absolute path."""
    relative = "" if cwd == ROOT else str(cwd.relative_to(ROOT))
    return f"~/{ROOT.name}" + (f"/{relative}" if relative else "")


def tree(start: str = "", depth: int = 3) -> dict[str, Any]:
    """The project as nested entries, directories first."""

    def walk(directory: Path, left: int) -> list[dict[str, Any]]:
        entries = []
        for child in sorted(directory.iterdir(),
                            key=lambda p: (p.is_file(), p.name.lower())):
            if _hidden(child):
                continue
            relative = str(child.relative_to(ROOT))
            if child.is_dir():
                entries.append({
                    "name": child.name,
                    "path": relative,
                    "kind": "dir",
                    "children": walk(child, left - 1) if left > 1 else None,
                })
            else:
                entries.append({
                    "name": child.name,
                    "path": relative,
                    "kind": "file",
                    "size": child.stat().st_size,
                    "readable": child.suffix.lower() in TEXT_SUFFIXES,
                })
        return entries

    base = resolve(start) if start else ROOT
    return {
        "root": str(base.relative_to(ROOT)) if base != ROOT else "",
        # What to show above the tree, so it is obvious which folder is being
        # listed when the explorer is rooted somewhere other than the project.
        "display": _display(base),
        "entries": walk(base, depth),
    }


SECRETS = {".env"}      # holds API keys: not in the file explorer; the terminal shows it when asked


def read(relative: str) -> dict[str, Any]:
    path = resolve(relative)
    if path.name in SECRETS:
        return {"path": relative, "error": "holds your keys, so it is not shown here"}
    if not path.is_file():
        return {"path": relative, "error": "not a file"}
    if path.suffix.lower() not in TEXT_SUFFIXES:
        return {"path": relative, "error": "not a text file"}

    raw = path.read_bytes()[:MAX_READ]
    try:
        text = raw.decode()
    except UnicodeDecodeError:
        return {"path": relative, "error": "not a text file"}

    return {
        "path": str(path.relative_to(ROOT)),
        "language": path.suffix.lstrip(".") or "text",
        "lines": text.split("\n"),
        "truncated": path.stat().st_size > MAX_READ,
    }


# ─────────────────────────────────────────────────────────────────────────────
# The terminal
#
# Not a shell. Each command is recognised and carried out here, so there is no
# interpreter to escape from and nothing destructive to reach.
# ─────────────────────────────────────────────────────────────────────────────

HELP = """Available commands:
  pwd                 print the current folder
  ls [-la] [path]     list files (-l details, -a dotfiles too)
  cd <path>           change folder
  cat <file>          print a file
  python3 <file.py>   run the app, a workshop script, or a step 6 branch
  clear               clear the screen"""

SCRIPT_TIMEOUT = 180


def prompt(cwd_relative: str = "") -> str:
    return _display(resolve(cwd_relative) if cwd_relative else ROOT)


def _ls(target: Path, long: bool = False, every: bool = False) -> str:
    """ls, with the two flags people reach for: -a also lists dotfiles,
    .env included (never the tool folders), -l one per line with size and
    date."""
    def shown(child: Path) -> bool:
        if child.name in HIDDEN:
            return False
        return every or not _hidden(child)      # .env is a dot file: ls -a shows it

    children = [target] if target.is_file() else sorted(
        (c for c in target.iterdir() if shown(c)), key=lambda p: (p.is_file(), p.name.lower()))
    if not long:
        return "  ".join(c.name + ("/" if c.is_dir() else "") for c in children)
    rows = []
    for child in children:
        info = child.stat()
        kind = "d" if child.is_dir() else "-"
        size = "-" if child.is_dir() else str(info.st_size)
        when = time.strftime("%b %d %H:%M", time.localtime(info.st_mtime))
        rows.append(f"{kind}  {size:>8}  {when}  {child.name}{'/' if child.is_dir() else ''}")
    return "\n".join(rows)


def _expand(line: str) -> str:
    """$JEV_MODEL and friends, filled the way an exported shell variable would
    be. A real shell would expand these from the environment; this terminal has
    no shell, so it does the same job here."""
    from server.services import environment

    values = environment.as_substitutions()

    def one(match: re.Match[str]) -> str:
        return values.get(match.group(1) or match.group(2), match.group(0))

    return re.sub(r"\$\{(\w+)\}|\$(\w+)", one, line)


def run(line: str, cwd_relative: str = "") -> dict[str, Any]:
    """Carry out one command line. Returns the output and the new folder."""
    line = _expand(line)
    cwd = resolve(cwd_relative) if cwd_relative else ROOT
    relative_cwd = "" if cwd == ROOT else str(cwd.relative_to(ROOT))
    reply = {"cwd": relative_cwd, "prompt": _display(cwd), "output": "",
             "started": False, "cleared": False}

    try:
        parts = shlex.split(line.strip())
    except ValueError:
        return {**reply, "output": "unbalanced quotes"}

    if not parts:
        return reply

    command, args = parts[0], parts[1:]

    if command == "clear":
        return {**reply, "cleared": True}

    if command == "help":
        return {**reply, "output": HELP}

    if command == "pwd":
        return {**reply, "output": _display(cwd)}

    if command == "ls":
        flags = "".join(a[1:] for a in args if a.startswith("-") and len(a) > 1)
        paths = [a for a in args if not (a.startswith("-") and len(a) > 1)]
        unknown = set(flags) - set("la")
        if unknown:
            return {**reply, "output": f"ls: -{''.join(sorted(unknown))}: this terminal knows -l and -a"}
        try:
            target = resolve(str(Path(relative_cwd) / paths[0])) if paths else cwd
        except OutsideWorkspace:
            return {**reply, "output": f"ls: {paths[0]}: outside the project"}
        if not target.exists():
            return {**reply, "output": f"ls: {paths[0]}: no such file or directory"}
        return {**reply, "output": _ls(target, long="l" in flags, every="a" in flags)}

    if command == "cd":
        if not args or args[0] == "~":
            return {**reply, "cwd": "", "prompt": _display(ROOT)}
        try:
            target = resolve(str(Path(relative_cwd) / args[0]))
        except OutsideWorkspace:
            return {**reply, "output": f"cd: {args[0]}: outside the project"}
        if not target.is_dir():
            return {**reply, "output": f"cd: {args[0]}: no such file or directory"}
        moved = "" if target == ROOT else str(target.relative_to(ROOT))
        return {**reply, "cwd": moved, "prompt": _display(target)}

    if command == "cat":
        if not args:
            return {**reply, "output": "cat: give it a file name"}
        try:
            target = resolve(str(Path(relative_cwd) / args[0]))
        except OutsideWorkspace:
            return {**reply, "output": f"cat: {args[0]}: outside the project"}
        if target.name in SECRETS and target.is_file():
            # Asked for by name in the terminal: show it, so people see where
            # their settings live. The explorer still never opens it.
            return {**reply, "output": target.read_text().rstrip("\n")}
        found = read(str(target.relative_to(ROOT)))
        if "error" in found:
            return {**reply, "output": f"cat: {args[0]}: {found['error']}"}
        return {**reply, "output": "\n".join(found["lines"])}

    if command in {"python3", "python"}:
        script = args[0] if args else ""
        try:
            target = resolve(str(Path(relative_cwd) / script)) if script else None
        except OutsideWorkspace:
            return {**reply, "output": f"python3: {script}: outside the project"}

        # The workshop's own scripts (scripts/, and the step 6 branches in
        # branches/) run for real, with any arguments after the
        # file name. Anything else in the project does not: this is a terminal
        # for the exercises, not an interpreter. They run on the workbench's
        # own interpreter, which is where the SDKs are installed.
        if target is not None and target.parent in RUNNABLE and target.is_file():
            from server.services import environment

            done = subprocess.run(
                [sys.executable, str(target), *args[1:]], cwd=ROOT,
                capture_output=True, text=True, timeout=SCRIPT_TIMEOUT,
                env=environment.script_env(),
            )
            out = (done.stdout + ("\n" if done.stdout and done.stderr else "")
                   + done.stderr).strip()
            return {**reply, "output": out or "(no output)"}

        if target == (ROOT / "app" / "main.py"):
            # appproc picks the app's own interpreter when there is one.
            outcome = appproc.start()
            if outcome["running"]:
                return {
                    **reply,
                    "started": True,
                    "output": (f"The arena is running on http://localhost:{outcome['port']}\n\n"
                               "leave this running and use it below — Stop in the panel ends it"),
                }
            return {**reply, "output": "the app did not start; check runs/app.log"}
        if script:
            return {**reply, "output": f"python3: can't open file '{script}': "
                                       "no such file in this folder"}
        return {**reply, "output": "python3: give it a file to run"}

    return {**reply, "output": f"{command}: command not found\n\n{HELP}"}
