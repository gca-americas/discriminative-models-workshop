"""Build the arena app one step at a time.

    python3 scripts/stage.py        which stage app/ is at, and what each adds
    python3 scripts/stage.py 5      bring app/ up to step 5
    python3 scripts/stage.py 3      back to step 3, "You fight" only

Each stage is a folder under stages/, laid out like app/, holding the files
that step adds:

    stages/03-you-fight/        the game and the "You fight" mode    (step 3)
    stages/05-model-fights/     the Discriminative model fights       (step 5)
    stages/06-workflow-fights/  the workflow fights                   (step 6)

Applying stage N rebuilds app/ from stage 3 and lays every later stage up to
N on top of it, in order. A file in a later stage replaces the same file from
an earlier one. Then, if the workbench is running the arena app, it is
restarted so the new modes appear.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STAGES = ROOT / "stages"
APP = ROOT / "app"
MARK = ROOT / "runs" / "stage.json"


def stages() -> list[tuple[int, str, Path]]:
    found = []
    for folder in sorted(STAGES.iterdir()):
        number, _, name = folder.name.partition("-")
        if folder.is_dir() and number.isdigit():
            found.append((int(number), name.replace("-", " "), folder))
    return found


def files(folder: Path) -> list[Path]:
    return sorted(p.relative_to(folder) for p in folder.rglob("*")
                  if p.is_file() and "__pycache__" not in p.parts)


def current() -> int | None:
    try:
        return json.loads(MARK.read_text())["stage"]
    except (OSError, ValueError, KeyError):
        return None


def apply(target: int) -> list[str]:
    known = stages()
    if target < known[0][0]:
        raise SystemExit(f"no stage {target}; the first is {known[0][0]}")
    # Remove every file any stage owns, then lay the stages down in order.
    for _, _, folder in known:
        for rel in files(folder):
            dest = APP / rel.relative_to("app")
            dest.unlink(missing_ok=True)
            # a folder only a later stage used (static/modes/) goes too
            for parent in dest.parents:
                if parent == APP or not parent.is_dir() or any(parent.iterdir()):
                    break
                parent.rmdir()
    added = []
    for number, name, folder in known:
        if number > target:
            break
        for rel in files(folder):
            dest = APP / rel.relative_to("app")
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(folder / rel, dest)
            if number > known[0][0]:
                added.append(f"{rel}  (step {number}: {name})")
    MARK.parent.mkdir(exist_ok=True)
    MARK.write_text(json.dumps({"stage": target}))
    return added


def restart_app(start_if_stopped: bool) -> str:
    """Restart the arena through the workbench so the new modes load. Adding a
    mode (step 5, 6) also starts it if it was stopped; going back to stage 3
    leaves it stopped, the way a workshop begins."""
    base = f"http://127.0.0.1:{os.environ.get('JEV101_PORT', '4900')}/api/app"
    try:
        with urllib.request.urlopen(base + "/status", timeout=2) as response:
            status = json.load(response)
    except OSError:
        return "Restart the arena app to pick up the change (Ctrl+C, then python3 main.py in app/)."
    was_running = status.get("running") or status.get("managed")
    if not was_running and not start_if_stopped:
        return "The arena app is stopped. Start it in step 3."
    for action in (("stop", "start") if was_running else ("start",)):
        request = urllib.request.Request(f"{base}/{action}", data=b"{}", method="POST",
                                         headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(request, timeout=30) as response:
            status = json.load(response)
    verb = "Restarted" if was_running else "Started"
    return f"{verb} the arena app." if status.get("running") else f"{verb} the arena app; it is still starting."


def main(argv: list[str]) -> int:
    known = stages()
    if not argv:
        at = current()
        print(f"app/ is at stage {at if at is not None else '? (never applied)'}\n")
        for number, name, folder in known:
            mark = "●" if at is not None and number <= at else "○"
            print(f"  {mark} {number}  {name}")
            for rel in files(folder):
                print(f"        {rel}")
        return 0
    try:
        target = int(argv[0])
    except ValueError:
        print(__doc__)
        return 2
    added = apply(target)
    reached = max(n for n, _, _ in known if n <= target)
    print(f"app/ is now at stage {reached}: {dict((n, name) for n, name, _ in known)[reached]}")
    for line in added:
        print(f"  + {line}")
    print(restart_app(start_if_stopped=reached > known[0][0]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
