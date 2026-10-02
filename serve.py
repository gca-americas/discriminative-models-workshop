"""Run the Getting started with Discriminative (Jev/DiffusionGemma) models workbench.

    python serve.py              port 4900 (JEV101_PORT to change)
    python serve.py --reload     for development

Started through this file rather than `uvicorn server.main:app` on purpose:
other workshops on the same machine look for stale servers of their own by
matching that exact command line, and on macOS they cannot tell whose it is.
A distinct name keeps them from stopping this one.
"""

import os
import sys

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "server.main:app",
        host=os.environ.get("JEV101_HOST", "0.0.0.0"),
        port=int(os.environ.get("JEV101_PORT", "4900")),
        log_level=os.environ.get("JEV101_LOG_LEVEL", "info"),
        reload="--reload" in sys.argv,
    )
