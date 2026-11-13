"""Is this machine ready for the workshop? Says what is and is not set up.

Exit code 0 when the decision model can be called. The verify panel
uses that; a person can just read the lines.
"""

from __future__ import annotations

import importlib.metadata as metadata
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_env(path: Path = ROOT / ".env") -> None:
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def version(package: str) -> str:
    try:
        return metadata.version(package)
    except metadata.PackageNotFoundError:
        return "not installed"


def mask(secret: str) -> str:
    return secret[:4] + "…" + secret[-3:] if len(secret) > 10 else "set"


def main() -> int:
    load_env()
    print(f"python          {sys.version.split()[0]}  ({sys.executable})")
    print(f"typesafe-sdk    {version('typesafe-sdk')}")
    print(f"google-genai    {version('google-genai')}")
    print(f"google-adk      {version('google-adk')}")
    print()

    sys.path.insert(0, str(ROOT / "scripts"))
    from jev_common import jev_backend

    base = os.environ.get("TYPESAFE_BASE_URL", "")
    key = os.environ.get("TYPESAFE_API_KEY", "")
    backend = jev_backend(base)
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or ""
    if backend == "gemini":
        if gemini_key:
            print(f"model           Gemini Decisions — GEMINI_API_KEY {mask(gemini_key)} → generativelanguage.googleapis.com")
        else:
            print("model           Gemini Decisions, but there is no GEMINI_API_KEY. Add it in step 2.")
        jev_ok = bool(gemini_key)
    elif backend == "cloud-run":
        print(f"model           DiffusionGemma on Cloud Run — {base}")
        try:
            import jevauth
            jevauth.prepare()
            print("                authorised with your Google identity token")
            jev_ok = True
        except Exception as problem:            # no gcloud login, usually
            print(f"                {problem}")
            jev_ok = False
    elif backend == "gemma-vm":
        vm = os.environ.get("JEV101_GEMMA_VM")
        print(f"model           DiffusionGemma on the {vm} VM — {base}")
        import urllib.request
        try:
            urllib.request.urlopen(base.rstrip("/") + "/health", timeout=4)
            print("                tunnel open, model answering")
            jev_ok = True
        except Exception:
            print("                not answering: scripts/gemma_warm.sh on  (starts the VM and the tunnel)")
            jev_ok = False
    elif backend == "self-hosted":
        print(f"model           self-hosted — calls go to {base}")
        print("                (a Jev-compatible server, e.g. OpenJev on DiffusionGemma)")
        jev_ok = True
    elif key:
        print(f"model           live — TYPESAFE_API_KEY {mask(key)} → api.typesafe.ai")
        jev_ok = True
    else:
        print("model           not chosen yet. Choose it in step 2, or run scripts/setup_model.sh.")
        print("                A Jev key comes from https://console.typesafe.ai/login?returnTo=%2Fkeys")
        jev_ok = False
    print(f"model id        {'gemini-decision-1' if backend == 'gemini' else os.environ.get('TYPESAFE_DEFAULT_MODEL', 'jev-latest')}")

    if gemini_key:
        print(f"gemini          API key {mask(gemini_key)} · reads the spell card and writes the tale in step 6")
    else:
        print("gemini          not set up yet — step 6 needs a Gemini API key. Add it in step 2,")
        print("                or create one at https://aistudio.google.com/apikey")
    print(f"gemini models   gemini-decision-1 (spell card) · "
          f"{os.environ.get('JEV101_GEMINI_MODEL') or 'gemini-3.8-flash'} (tale)")
    print()
    print("model: ready" if jev_ok else "model: not ready")
    return 0 if jev_ok else 1


if __name__ == "__main__":
    sys.exit(main())
