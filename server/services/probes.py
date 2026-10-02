"""Running a check.

The principle, borrowed and worth stating plainly: the page is never believed.
A check does not ask the student whether they did the thing, and it does not
grep their files. It runs a read-only command against the real world and reads
the answer.

Every probe is a command the student could have typed themselves, and the
verify panel shows it to them. That is deliberate: the check is also a lesson
in how you would find this out without a workbench.
"""

from __future__ import annotations

import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any

# Probes are read-only by construction: only these binaries may be invoked, and
# only through argv (never a shell), so there is nothing for a stray quote or a
# semicolon in a content file to escape into. `python3` is the workbench's own
# interpreter and may only run files under scripts/.
ALLOWED = {"curl", "python3", "cat"}

TIMEOUT = 45


class ProbeRefused(Exception):
    """A probe that is not read-only, or names a binary we do not allow."""


def _substitute(command: str, env: dict[str, str]) -> str:
    """$PROJECT and friends, filled from the discovered environment."""

    def one(match: re.Match[str]) -> str:
        name = match.group(1) or match.group(2)
        return env.get(name, "")

    return re.sub(r"\$\{(\w+)\}|\$(\w+)", one, command)


def _vet(argv: list[str]) -> None:
    if not argv:
        raise ProbeRefused("empty probe")
    if argv[0] not in ALLOWED:
        raise ProbeRefused(f"{argv[0]} is not an allowed probe binary")
    if argv[0] == "python3":
        if len(argv) < 2 or not argv[1].startswith("scripts/") or not argv[1].endswith(".py"):
            raise ProbeRefused("python3 probe may only run a file under scripts/")
    if argv[0] == "curl":
        # -s -o /dev/null -w '%{http_code}' style probes only: no uploads.
        if any(flag in argv for flag in ("-d", "--data", "-T", "--upload-file", "-X")):
            raise ProbeRefused("curl probe may only read")
    if argv[0] == "cat":
        # cat only reads, but a probe's output is shown in the verify panel, so
        # it may not read hidden files: that is where credentials live.
        for argument in argv[1:]:
            if argument.startswith("-"):
                raise ProbeRefused("cat probe takes no flags")
            if any(part.startswith(".") and part not in (".", "..")
                   for part in Path(argument).parts):
                raise ProbeRefused(f"cat probe may not read hidden paths: {argument}")


def run_probe(command: str, env: dict[str, str]) -> dict[str, Any]:
    """Run one probe. Returns the raw evidence; asserting is a separate step so
    a failing check can still show the student what the command actually said."""
    filled = _substitute(command, env)
    # `~` is the shell's doing, and probes never see a shell, so expand it here.
    argv = [os.path.expanduser(argument) for argument in shlex.split(filled)]
    _vet(argv)
    if argv[0] == "python3":
        argv[0] = sys.executable

    from server.services import environment  # late: avoids a cycle
    from server import config

    try:
        proc = subprocess.run(
            argv, capture_output=True, text=True, timeout=TIMEOUT,
            cwd=config.ROOT, env=environment.script_env(),
        )
    except subprocess.TimeoutExpired:
        return {"command": filled, "code": 124, "out": "", "err": "timed out", "ok": False}
    except FileNotFoundError:
        return {"command": filled, "code": 127, "out": "", "err": f"{argv[0]} not installed", "ok": False}

    return {
        # Show what the author wrote, not the expanded form: `python3` is what
        # the student would type.
        "command": filled,
        "code": proc.returncode,
        "out": proc.stdout.strip(),
        "err": proc.stderr.strip(),
        "ok": proc.returncode == 0,
    }


def _as_json(text: str) -> Any:
    try:
        return json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return None


def assert_on(spec: dict[str, Any], evidence: dict[str, Any],
              env: dict[str, str] | None = None) -> bool:
    """The small vocabulary of assertions a step.yaml may use."""
    kind = spec.get("assert", "succeeds")
    out = evidence["out"]
    want = _substitute(str(spec.get("value", "")), env or {})

    if kind == "succeeds":
        return evidence["ok"]
    if kind == "nonempty":
        return evidence["ok"] and bool(out)
    if kind == "equals":
        return out == want
    if kind == "contains":
        return want.lower() in out.lower()
    if kind == "not_contains":
        return want.lower() not in out.lower()
    if kind == "matches":
        return bool(re.search(want, out))
    if kind == "json_nonempty":
        parsed = _as_json(out)
        return bool(parsed)
    if kind == "json_count_gte":
        parsed = _as_json(out)
        return isinstance(parsed, list) and len(parsed) >= int(spec.get("value", 1))
    if kind == "json_contains":
        # Substring match over the serialised JSON: enough for "is this role
        # bound", without teaching step.yaml a query language.
        parsed = _as_json(out)
        return parsed is not None and want.lower() in json.dumps(parsed).lower()
    return False


def evaluate(spec: dict[str, Any], env: dict[str, str]) -> dict[str, Any]:
    """One check, end to end: run it, judge it, and hand back both."""
    try:
        evidence = run_probe(spec["probe"], env)
    except ProbeRefused as refusal:
        return {
            "id": spec["id"], "label": spec["label"], "passed": False,
            "command": spec["probe"], "detail": f"probe refused: {refusal}",
            "hint": spec.get("hint", ""), "refused": True,
        }

    passed = assert_on(spec, evidence, env)
    detail = evidence["out"] if evidence["ok"] else (evidence["err"] or evidence["out"])
    return {
        "id": spec["id"],
        "label": spec["label"],
        "passed": passed,
        "command": evidence["command"],
        "detail": detail[:2000],
        "hint": "" if passed else spec.get("hint", ""),
        "refused": False,
    }
