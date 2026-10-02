"""Judging what a student asked for.

Exercises in this course don't hand the student a command to press. They ask
the student to say what they want, in their own words, the way they would ask
an assistant. If the intent is right, the workbench runs the real command in
Cloud Shell on their behalf.

Two judges, in order of preference:

  1. The course assistant, if one is deployed (CLOUD101_AGENT_URL). It reads
     the utterance, the step, and what the step expects, and returns a verdict.
  2. A local matcher, always available. Concept groups with synonyms: the
     utterance has to name every required concept and none of the excluded
     ones.

The local matcher is not a fallback of last resort -- it is the default, and
the course has to work fully without an assistant deployed. A workshop where
the assistant is down is still a workshop.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from typing import Any

AGENT_URL = os.environ.get("CLOUD101_AGENT_URL", "").rstrip("/")
AGENT_TIMEOUT = float(os.environ.get("CLOUD101_AGENT_TIMEOUT", "12"))


def _normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", text.lower())


def _group_matches(utterance: str, group: list[str],
                   captured: dict[str, str] | None = None) -> bool:
    """A group is satisfied by any of its terms, or by a capture it names.

    The capture case matters: someone who writes "use europe-west1 as the
    default" has named a region without using the word "region", and refusing
    that would teach vocabulary rather than intent.
    """
    for term in group:
        if term.startswith("@capture:"):
            if (captured or {}).get(term.split(":", 1)[1]):
                return True
        elif term.lower() in utterance:
            return True
    return False


def judge_locally(utterance: str, expect: dict[str, Any],
                  captured: dict[str, str] | None = None) -> dict[str, Any]:
    """Concept matching. Blunt, predictable, and offline."""
    normalised = _normalise(utterance)
    feedback = expect.get("feedback", {}) or {}

    if len(normalised.strip()) < 3:
        return {"ok": False, "by": "local",
                "feedback": "Say what you want to do, in a sentence."}

    for group in expect.get("rejects", []) or []:
        if _group_matches(normalised, group, captured):
            return {
                "ok": False, "by": "local",
                "feedback": feedback.get("rejected",
                                         "That names the wrong kind of resource. Try again."),
            }

    for index, group in enumerate(expect.get("requires", []) or []):
        if not _group_matches(normalised, group, captured):
            return {
                "ok": False, "by": "local",
                "feedback": feedback.get(
                    f"missing_{index}",
                    "Your request is missing something the command needs.",
                ),
            }

    return {"ok": True, "by": "local",
            "feedback": feedback.get("accepted", "That's the right request.")}


def judge_with_agent(utterance: str, expect: dict[str, Any],
                     context: dict[str, Any]) -> dict[str, Any] | None:
    """Ask the deployed course assistant. Returns None if it can't be reached,
    so the caller falls back rather than blocking the student."""
    if not AGENT_URL:
        return None

    payload = json.dumps({
        "utterance": utterance,
        "expect": expect,
        "step": context.get("slug"),
        "task": context.get("task"),
        "goal": expect.get("goal", ""),
    }).encode()

    request = urllib.request.Request(
        f"{AGENT_URL}/judge",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=AGENT_TIMEOUT) as response:
            body = json.loads(response.read().decode())
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None

    if not isinstance(body, dict) or "ok" not in body:
        return None

    return {
        "ok": bool(body.get("ok")),
        "by": "assistant",
        "feedback": str(body.get("feedback", ""))[:600],
    }


def capture(utterance: str, expect: dict[str, Any]) -> tuple[dict[str, str], str | None]:
    """Pull values out of what the student wrote, so their words become the
    command's arguments. "put it in europe-west1" has to end up as a region.

    Returns the captured variables, and the name of the first one that was
    asked for and not found.
    """
    captured: dict[str, str] = {}
    for name, pattern in (expect.get("capture") or {}).items():
        found = re.search(pattern, utterance, re.IGNORECASE)
        if not found:
            return captured, name
        captured[name] = (found.group(1) if found.groups() else found.group(0)).strip()
    return captured, None


def judge(utterance: str, expect: dict[str, Any], context: dict[str, Any],
          captured: dict[str, str] | None = None) -> dict[str, Any]:
    verdict = judge_with_agent(utterance, expect, context)
    if verdict is not None:
        # The assistant judges intent; the local matcher keeps the final say on
        # the excluded resources, so a talkative model can't wave through a
        # request for the wrong thing.
        if verdict["ok"]:
            local = judge_locally(utterance, expect, captured)
            if not local["ok"]:
                return local
        return verdict
    return judge_locally(utterance, expect, captured)


def resolve(utterance: str, expect: dict[str, Any],
            context: dict[str, Any]) -> dict[str, Any]:
    """Extract whatever the command needs, then judge the request.

    Captures run first so that naming a real resource can stand in for naming
    its category, which is how people actually speak.
    """
    captured, missing = capture(utterance, expect)

    verdict = judge(utterance, expect, context, captured)
    if not verdict["ok"]:
        return {**verdict, "captured": {}}

    if missing:
        feedback = (expect.get("feedback", {}) or {}).get(
            f"capture_{missing}",
            f"Include the {missing.lower().replace('_', ' ')} in your request.",
        )
        return {"ok": False, "by": verdict["by"], "feedback": feedback, "captured": {}}

    return {**verdict, "captured": captured}
