"""How this workshop reaches its decision model, wherever that model lives.

The places a decision call can go. The first four speak Jev's API and are
reached with typesafe-sdk; the last is reached with google-genai
(scripts/decisions.py holds both calls):

  typesafe     https://api.typesafe.ai            TYPESAFE_API_KEY from the console
  gemma-vm     http://127.0.0.1:8096              DiffusionGemma on your own L4 VM, through
                                                  an IAP tunnel (scripts/setup_gemma.sh)
  cloud-run    https://djev-…run.app              DiffusionGemma on your own Cloud Run,
                                                  authorised with a Google identity token
  self-hosted  any other Jev-compatible server    e.g. OpenJev on a GPU box
  gemini       generativelanguage.googleapis.com  Gemini Decisions (gemini-decision-1),
                                                  GEMINI_API_KEY, when .env has JEV101_MODEL=gemini

The Cloud Run case is the one that needs help. The service is private, so each
request carries a Google identity token as its bearer key. Tokens last an hour
and a workshop lasts longer, so `prepare()` fetches one from gcloud and fetches
again before it expires. Every call site calls `prepare()` just before it makes
a client, and passes `client_kwargs()` to it.
"""

from __future__ import annotations

import os
import subprocess
import time

TOKEN_LIFETIME = 45 * 60          # refresh well before Google's 60 minutes
_token = {"value": "", "at": 0.0}


def backend(base_url: str | None = None) -> str:
    if os.environ.get("JEV101_MODEL", "").strip().lower() == "gemini":
        return "gemini"
    base = (base_url if base_url is not None else os.environ.get("TYPESAFE_BASE_URL", "")).rstrip("/")
    if not base or "api.typesafe.ai" in base:
        return "typesafe"
    if ".run.app" in base:
        return "cloud-run"
    if os.environ.get("JEV101_GEMMA_VM"):
        return "gemma-vm"
    return "self-hosted"


def _identity_token() -> str:
    if _token["value"] and time.time() - _token["at"] < TOKEN_LIFETIME:
        return _token["value"]
    done = subprocess.run(["gcloud", "auth", "print-identity-token"],
                          capture_output=True, text=True, timeout=30)
    token = done.stdout.strip()
    if done.returncode != 0 or not token:
        raise RuntimeError("could not get a Google identity token for the Cloud Run model: "
                           + (done.stderr.strip() or "gcloud printed nothing")
                           + "\nRun `gcloud auth login`, then try again.")
    _token.update(value=token, at=time.time())
    return token


def prepare() -> None:
    """Make sure TYPESAFE_API_KEY is something the current backend accepts.
    Gemini Decisions has its own key, GEMINI_API_KEY, and needs nothing here."""
    kind = backend()
    if kind == "cloud-run" and os.environ.get("JEV101_JEV_AUTH", "gcloud") == "gcloud":
        os.environ["TYPESAFE_API_KEY"] = _identity_token()
    elif kind in ("self-hosted", "cloud-run", "gemma-vm"):
        os.environ.setdefault("TYPESAFE_API_KEY", "self-hosted")


def client_kwargs() -> dict:
    """Timeout for the client. A Cloud Run model that has scaled to zero takes
    about 48 s to wake, far past the SDK's 10 s default."""
    default = {"cloud-run": "90", "gemma-vm": "30"}.get(backend(), "10")
    return {"timeout": float(os.environ.get("JEV101_JEV_TIMEOUT", default))}


def describe() -> str:
    base = os.environ.get("TYPESAFE_BASE_URL", "")
    return {
        "typesafe": "The Discriminative model on api.typesafe.ai",
        "cloud-run": f"DiffusionGemma on Cloud Run ({base})",
        "gemma-vm": f"DiffusionGemma on the {os.environ.get('JEV101_GEMMA_VM')} VM, via the IAP tunnel ({base})",
        "self-hosted": f"a Jev-compatible server at {base}",
        "gemini": "Gemini Decisions (gemini-decision-1) on the Gemini Developer API",
    }[backend()]
