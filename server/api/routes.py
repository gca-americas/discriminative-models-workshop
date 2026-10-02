"""The workbench API.

One endpoint per question the page needs answered. Nothing here holds student
state: progress is derived from the world (is the key set? does the app
answer?), never stored, so a student who reloads or comes back tomorrow is
exactly where their machine says they are.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Request
from fastapi.responses import StreamingResponse

from server import config
from server.services import (appproc, code, content, environment, intent, probes,
                             runs, workspace)

router = APIRouter(prefix="/api")


@router.get("/course")
def get_course() -> dict[str, Any]:
    steps = content.all_steps()
    return {
        "course": content.course(),
        "steps": [s.card() for s in steps],
        "totalMinutes": sum(s.minutes for s in steps),
    }


@router.get("/steps/{slug}")
def get_step(slug: str) -> dict[str, Any]:
    found = content.step(slug)
    if not found:
        raise HTTPException(404, f"no step named {slug}")
    return found.full()


@router.get("/env")
def get_env(refresh: bool = False) -> dict[str, Any]:
    return environment.discover(force=refresh)


@router.post("/check/{slug}")
def check_step(slug: str, part: str | None = None) -> dict[str, Any]:
    found = content.step(slug)
    if not found:
        raise HTTPException(404, f"no step named {slug}")

    substitutions = environment.as_substitutions()
    specs = content.checks_for(slug, part)
    results = [probes.evaluate(spec, substitutions) for spec in specs]
    env = environment.discover(force=True)
    # DiffusionGemma takes about 15 minutes to come up. While it does, a model
    # check has not failed; it is waiting.
    if env["modelSetup"] == "gemma":
        for spec, result in zip(specs, results):
            if "check_setup.py" in spec.get("probe", "") and not result["passed"]:
                result.update(pending=True, hint=GEMMA_PENDING)
    return {
        "slug": slug,
        "results": results,
        "passed": all(r["passed"] for r in results) if results else True,
        "env": env,
    }


GEMMA_PENDING = (
    "DiffusionGemma is still being set up and will not be ready for a while, about "
    "15 minutes the first time. Keep going. When *model · gemma on vm* at the top "
    "right turns green, it is ready. Click it to check that the endpoint works."
)


@router.post("/model-check")
def model_check() -> dict[str, Any]:
    """The model light, clicked: ask the model now rather than trust the last look."""
    environment.check_server_now()
    env = environment.discover(force=True)
    if not env["modelReady"] and env["jev"] == "live":
        environment.verify_jev_now()
        env = environment.discover(force=True)
    if env["modelSetup"]:
        message = "Still being set up."
    elif env["modelReady"]:
        message = "The model answered."
    elif env["jev"] == "no key":
        message = "No model chosen yet. Step 2 sets it up."
    else:
        message = "The model did not answer."
    return {"env": env, "message": message}


@router.post("/check/{slug}/{check_id}")
def check_one(slug: str, check_id: str) -> dict[str, Any]:
    spec = content.check_spec(slug, check_id)
    if not spec:
        raise HTTPException(404, f"no check {check_id} in {slug}")
    return probes.evaluate(spec, environment.as_substitutions())


@router.post("/run/{slug}/{task_id}")
def start_run(slug: str, task_id: str) -> dict[str, Any]:
    task = content.task_spec(slug, task_id)
    if not task:
        raise HTTPException(404, f"no task {task_id} in {slug}")
    if task.get("kind") != "command":
        raise HTTPException(400, f"task {task_id} is not a command")

    token = runs.start(slug, task_id, task["command"], environment.as_substitutions())
    return {"token": token}


MODELS = {"jev", "gemma", "rehearsal"}


@router.post("/model-setup")
def model_setup(model: str = Body(..., embed=True),
                key: str = Body("", embed=True)) -> dict[str, Any]:
    """Step 2: choose the decision model. Runs scripts/setup_model.sh, which
    checks the choice before it keeps it. A Jev key goes to the script in its
    environment, never on its command line."""
    if model not in MODELS:
        raise HTTPException(400, f"model must be one of {sorted(MODELS)}")
    command = f"scripts/setup_model.sh --model {model} --yes --no-fallback"
    process_env: dict[str, str | None] = {
        "TYPESAFE_API_KEY": key.strip() or None,   # none: the script reads .env
        "TYPESAFE_BASE_URL": None,
    }
    token = runs.start("run-it", "model", command, environment.as_substitutions(), process_env)
    environment.MODEL_SETUP.update(token=token, model=model)
    return {"token": token, "command": command}


@router.get("/model-setup")
def model_setup_status() -> dict[str, Any]:
    """The latest step 2 run, so the panel can pick up a DiffusionGemma setup
    that is still going after the student has moved on and come back."""
    token = environment.MODEL_SETUP.get("token")
    record = runs.status(token) if token else None
    if not record:
        return {"token": None}
    return {**record, "model": environment.MODEL_SETUP.get("model"), "log": runs.read_log(token)}


def _edit_task(slug: str, task_id: str) -> dict[str, Any]:
    task = content.task_spec(slug, task_id)
    if not task or task.get("kind") != "edit":
        raise HTTPException(404, f"no edit task {task_id} in {slug}")
    return task


@router.get("/code/{slug}/{task_id}")
def code_read(slug: str, task_id: str) -> dict[str, Any]:
    try:
        return {"ok": True, **code.read(_edit_task(slug, task_id))}
    except code.EditError as error:
        return {"ok": False, "error": str(error)}


@router.post("/code/{slug}/{task_id}")
def code_write(slug: str, task_id: str, content_: str = Body(..., embed=True, alias="content")) -> dict[str, Any]:
    try:
        return {"ok": True, **code.write(_edit_task(slug, task_id), content_)}
    except code.EditError as error:
        return {"ok": False, "error": str(error)}


@router.post("/code/{slug}/{task_id}/reset")
def code_reset(slug: str, task_id: str) -> dict[str, Any]:
    try:
        return {"ok": True, **code.reset(_edit_task(slug, task_id))}
    except code.EditError as error:
        return {"ok": False, "error": str(error)}


@router.post("/intent/{slug}/{task_id}")
def submit_intent(slug: str, task_id: str,
                  utterance: str = Body(..., embed=True)) -> dict[str, Any]:
    """The student says what they want. If that is what the step asked for, the
    command runs in their shell -- they never see it until afterwards."""
    task = content.task_spec(slug, task_id)
    if not task:
        raise HTTPException(404, f"no task {task_id} in {slug}")
    # `provision`, `deploy` and a `files` task with an `expect` are intents
    # too: they differ in how the page presents them, not in how they are judged.
    if task.get("kind") not in {"intent", "provision", "deploy", "files"} \
            or not task.get("expect"):
        raise HTTPException(400, f"task {task_id} does not take an intent")

    verdict = intent.resolve(utterance, task.get("expect") or {},
                             {"slug": slug, "task": task_id})

    if not verdict["ok"]:
        return {**verdict, "token": None, "command": None}

    command = task.get("command")
    if not command:
        return {**verdict, "token": None, "command": None}

    # What the student said becomes the command's arguments.
    substitutions = {**environment.as_substitutions(), **verdict.get("captured", {})}
    token = runs.start(slug, task_id, command, substitutions)
    return {**verdict, "token": token, "command": runs.fill(command, substitutions)}


@router.get("/run/{token}")
def run_status(token: str) -> dict[str, Any]:
    record = runs.status(token)
    if not record:
        raise HTTPException(404, "unknown run")
    # The log is the source of truth once a run ends: the proxy may have eaten
    # stream lines, the file never lies.
    return {**record, "log": runs.read_log(token)}


@router.get("/files/tree")
def files_tree(start: str = "", depth: int = 3) -> dict[str, Any]:
    try:
        return workspace.tree(start, depth)
    except workspace.OutsideWorkspace:
        raise HTTPException(400, "outside the project")


@router.get("/files/read")
def files_read(path: str) -> dict[str, Any]:
    try:
        return workspace.read(path)
    except workspace.OutsideWorkspace:
        raise HTTPException(400, "outside the project")


@router.post("/shell")
def shell(line: str = Body(..., embed=True),
          cwd: str = Body("", embed=True)) -> dict[str, Any]:
    """One command from the terminal panel. Not a shell: see workspace.run."""
    try:
        return workspace.run(line, cwd)
    except workspace.OutsideWorkspace:
        raise HTTPException(400, "outside the project")


@router.get("/app/status")
def app_status() -> dict[str, Any]:
    return appproc.status()


@router.post("/app/start")
def app_start() -> dict[str, Any]:
    return appproc.start()


@router.post("/app/stop")
def app_stop() -> dict[str, Any]:
    return appproc.stop()


@router.get("/app/log")
def app_log() -> dict[str, Any]:
    return {"log": appproc.read_log()}


@router.get("/events")
async def events(request: Request) -> StreamingResponse:
    queue = runs.subscribe()

    async def stream():
        # Some proxies (Cloud Shell's, for one) will not flush a response until
        # it has a couple of kilobytes, so the stream opens with padding.
        yield ":" + " " * 2048 + "\n\n"
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=10)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            runs.unsubscribe(queue)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── the arena app's stage (scripts/stage.py) ────────────────────────────────

def _stage_module():
    import importlib.util
    spec = importlib.util.spec_from_file_location("stage", config.ROOT / "scripts" / "stage.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@router.get("/stage")
def stage_status() -> dict[str, Any]:
    """Which step app/ is built up to, and the steps it can be set to."""
    stage = _stage_module()
    return {"stage": stage.current(),
            "stages": [{"number": n, "name": name} for n, name, _ in stage.stages()]}


@router.get("/stage/changes")
def stage_changes(since: int, to: int) -> dict[str, Any]:
    """What app/ gains between two stages: each file a later stage adds, and
    for a file it replaces, the line numbers that differ. The explorer marks
    these so a student can see what a step changed."""
    import difflib

    stage = _stage_module()
    known = stage.stages()
    before: dict[str, list[str]] = {}
    for number, _, folder in known:
        if number <= since:
            for rel in stage.files(folder):
                before[str(rel)] = (folder / rel).read_text(errors="replace").splitlines()
    changes: dict[str, dict[str, Any]] = {}
    for number, _, folder in known:
        if not since < number <= to:
            continue
        for rel in stage.files(folder):
            key = str(rel)
            after = (folder / rel).read_text(errors="replace").splitlines()
            if key not in before:
                changes[key] = {"path": key, "status": "added", "lines": []}
                continue
            lines = []
            matcher = difflib.SequenceMatcher(a=before[key], b=after, autojunk=False)
            for tag, _, _, j1, j2 in matcher.get_opcodes():
                if tag != "equal":
                    lines.extend(range(j1 + 1, j2 + 1))
            changes[key] = {"path": key, "status": "changed", "lines": lines}
    return {"since": since, "to": to, "files": sorted(changes.values(), key=lambda c: c["path"])}


@router.post("/stage")
def stage_apply(number: int = Body(..., embed=True)) -> dict[str, Any]:
    """Set app/ to a step: the same as `python3 scripts/stage.py N` in the
    terminal, run the same way, so it restarts the app the same way too."""
    import subprocess
    import sys

    done = subprocess.run([sys.executable, str(config.ROOT / "scripts" / "stage.py"), str(number)],
                          cwd=config.ROOT, capture_output=True, text=True, timeout=90,
                          env=environment.script_env())
    return {"ok": done.returncode == 0, "output": (done.stdout + done.stderr).strip(),
            **stage_status()}
