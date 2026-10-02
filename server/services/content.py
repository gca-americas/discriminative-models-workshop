"""Loading the course from disk.

A step is a directory under content/steps/ named NN-slug. The numeric prefix is
the order; nothing else decides it, so there is no registry to keep in sync.

A step is made of parts -- short screens, each with its own concepts, figures
and (sometimes) its own exercise. Parts are what keep a screen from becoming a
wall: a student moves through 4a, 4b, 4c rather than scrolling one long page.

    step.yaml       meta, and the list of parts
    a-something.md  one part's concepts
    b-else.md

A step with no parts is read as a single unnamed part whose body is step.md,
so a simple step stays a two-file directory.

Content is re-read on every request. The course is a few hundred kilobytes of
markdown, and an author editing a part should see it by reloading the tab.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from server import config


@dataclass
class Part:
    id: str
    label: str
    headline: str
    body: str
    exercise: dict[str, Any] | None
    checks: list[dict[str, Any]] = field(default_factory=list)
    after: dict[str, Any] | None = None

    def chip(self) -> dict[str, Any]:
        return {"id": self.id, "label": self.label,
                "hasExercise": self.exercise is not None,
                "checkCount": len(self.checks)}

    def full(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "headline": self.headline,
            "body": self.body,
            "exercise": self.exercise,
            "checks": [_public_check(c) for c in self.checks],
            "after": self.after,
        }


@dataclass
class Step:
    slug: str
    order: int
    title: str
    kicker: str
    part_id: str
    minutes: int
    color: str
    summary: str
    parts: list[Part]

    def card(self) -> dict[str, Any]:
        return {
            "slug": self.slug,
            "order": self.order,
            "title": self.title,
            "kicker": self.kicker,
            "part": self.part_id,
            "minutes": self.minutes,
            "color": self.color,
            "summary": self.summary,
            "parts": [p.chip() for p in self.parts],
        }

    def full(self) -> dict[str, Any]:
        return {**self.card(), "partDetail": [p.full() for p in self.parts]}

    def find(self, part_id: str | None) -> Part | None:
        if not self.parts:
            return None
        if part_id is None:
            return self.parts[0]
        return next((p for p in self.parts if p.id == part_id), None)


def _public_check(check: dict[str, Any]) -> dict[str, Any]:
    """A check as the page sees it. The probe stays on the server: the page
    never runs commands, it asks /api/check and is told what the world said."""
    return {"id": check["id"], "label": check["label"], "hint": check.get("hint", "")}


def course() -> dict[str, Any]:
    return yaml.safe_load((config.CONTENT / "course.yaml").read_text()) or {}


def _read(directory: Path, name: str | None) -> str:
    if not name:
        return ""
    path = directory / name
    return path.read_text() if path.exists() else ""


def _parse(directory: Path) -> Step | None:
    meta_path = directory / "step.yaml"
    if not meta_path.exists():
        return None

    meta = yaml.safe_load(meta_path.read_text()) or {}
    prefix, _, slug = directory.name.partition("-")
    try:
        order = int(prefix)
    except ValueError:
        return None

    raw_parts = meta.get("parts")
    if raw_parts:
        parts = [
            Part(
                id=str(part.get("id", index)),
                label=part.get("label", ""),
                headline=part.get("headline", ""),
                body=_read(directory, part.get("body")),
                exercise=part.get("exercise"),
                checks=part.get("checks") or [],
                after=part.get("after"),
            )
            for index, part in enumerate(raw_parts)
        ]
    else:
        # A step that never grew parts: one unnamed part, body in step.md.
        parts = [
            Part(
                id="",
                label="",
                headline=meta.get("headline", ""),
                body=_read(directory, "step.md"),
                exercise=meta.get("exercise"),
                checks=meta.get("checks") or [],
                after=meta.get("after"),
            )
        ]

    return Step(
        slug=meta.get("slug", slug),
        order=order,
        title=meta.get("title", slug),
        kicker=meta.get("kicker", f"Step {order}"),
        part_id=meta.get("part", ""),
        minutes=int(meta.get("minutes", 15)),
        color=meta.get("color", "sky"),
        summary=meta.get("summary", ""),
        parts=parts,
    )


def all_steps() -> list[Step]:
    if not config.STEPS.exists():
        return []
    found = [_parse(d) for d in sorted(config.STEPS.iterdir()) if d.is_dir()]
    return [s for s in found if s is not None]


def step(slug: str) -> Step | None:
    return next((s for s in all_steps() if s.slug == slug), None)


def _all_checks(found: Step, part_id: str | None) -> list[dict[str, Any]]:
    if part_id is None:
        return [check for part in found.parts for check in part.checks]
    part = found.find(part_id)
    return part.checks if part else []


def checks_for(slug: str, part_id: str | None = None) -> list[dict[str, Any]]:
    found = step(slug)
    return _all_checks(found, part_id) if found else []


def check_spec(slug: str, check_id: str) -> dict[str, Any] | None:
    for check in checks_for(slug):
        if check["id"] == check_id:
            return check
    return None


def task_spec(slug: str, task_id: str) -> dict[str, Any] | None:
    found = step(slug)
    if not found:
        return None
    for part in found.parts:
        for task in (part.exercise or {}).get("tasks", []):
            if task.get("id") == task_id:
                return task
    return None
