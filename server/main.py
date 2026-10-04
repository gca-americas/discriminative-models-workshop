"""The Getting started with Discriminative (Jev/DiffusionGemma) models workbench server.

Serves the API and, in production, the built page. In development the Vite dev
server proxies /api here instead.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from fastapi import Request
from fastapi.responses import Response

from server import config
from server.api.routes import router
from server.services import appproc, runs


def build_inspector() -> FastAPI | None:
    """ADK's development UI (`adk web`) and its API, as a sub-application at
    /inspector. It loads the same workflow as `scripts/arena.py`
    (agents/arena/agent.py), so a student can run it and see every node,
    event and state change. url_prefix tells the UI where its backend lives.
    If ADK cannot load, the rest of the workbench still runs."""
    try:
        from google.adk.cli.fast_api import get_fast_api_app

        return get_fast_api_app(
            agents_dir=str(config.ROOT / "agents"),
            web=True,
            url_prefix="/inspector",
            allow_origins=["*"],
            use_local_storage=False,
        )
    except Exception as error:  # noqa: BLE001 - report, keep serving the workbench
        INSPECTOR_ERROR.append(f"{type(error).__name__}: {error}")
        return None


INSPECTOR_ERROR: list[str] = []
inspector = build_inspector()


@asynccontextmanager
async def lifespan(app: FastAPI):
    runs.bind_loop(asyncio.get_running_loop())
    # The arena starts stopped: students start it themselves in step 3. An
    # arena left running by an earlier workbench is stopped here.
    await asyncio.to_thread(appproc.stop)
    if inspector is None:
        yield
        return
    # Starlette does not run a mounted app's lifespan; run the inspector's
    # explicitly so its own startup and shutdown hooks fire.
    async with inspector.router.lifespan_context(inspector):
        yield


app = FastAPI(title="Getting started with Discriminative (Jev/DiffusionGemma) models", lifespan=lifespan)
app.include_router(router)


@app.get("/api/inspector")
def inspector_status() -> dict:
    """Is ADK web mounted, and where. The page shows this next to the frame."""
    return {"up": inspector is not None, "url": "/inspector/dev-ui/?app=arena",
            "app": "arena", "error": INSPECTOR_ERROR[0] if INSPECTOR_ERROR else ""}


if inspector is not None:
    app.mount("/inspector", inspector)


@app.api_route("/app", methods=["GET"])
@app.api_route("/app/{path:path}", methods=["GET", "POST"])
async def student_app(request: Request, path: str = "") -> Response:
    """Everything under /app is the student's app, running in its own process.

    Served through here rather than framed directly so the iframe is
    same-origin and only one port needs to be reachable (which matters in Cloud Shell).
    """
    if not request.url.path.endswith("/") and path == "":
        return Response(status_code=307, headers={"Location": "/app/"})

    body = await request.body() if request.method == "POST" else None
    # urllib blocks; run it off the event loop so a game polling every 300 ms
    # cannot stall the rest of the workbench (SSE, status, the terminal).
    status, payload, headers = await asyncio.to_thread(
        appproc.proxy, path or "/", request.method, body, dict(request.headers)
    )
    headers.pop("Content-Length", None)
    return Response(content=payload, status_code=status, headers=headers)


# Images a step shows with :::figure src="…": content/images/<file>.
(config.ROOT / "content" / "images").mkdir(parents=True, exist_ok=True)
app.mount("/content-images", StaticFiles(directory=config.ROOT / "content" / "images"), name="content-images")
# The spell cards the step 6b slow branch can read.
if (config.ROOT / "branches" / "cards").is_dir():
    app.mount("/branch-cards", StaticFiles(directory=config.ROOT / "branches" / "cards"), name="branch-cards")

if config.WEB_DIST.exists():
    app.mount("/assets", StaticFiles(directory=config.WEB_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        """Every unknown path is a page route: hand back the shell and let the
        router sort it out."""
        candidate = config.WEB_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        # Never cached: after a rebuild, the page must load the new script.
        return FileResponse(config.WEB_DIST / "index.html", headers={"Cache-Control": "no-cache"})
