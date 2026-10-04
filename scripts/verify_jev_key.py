"""Check a TypeSafe API key with one real request to api.typesafe.ai.

    TYPESAFE_API_KEY=apikey_... python3 scripts/verify_jev_key.py

The key comes from the environment, or from .env at the root of the workshop,
never from the command line, so it does not show up in the process list.

Exit codes:
    0   the key works
    1   TypeSafe refused the key
    2   TypeSafe could not be reached, or there is no key to check
"""

from __future__ import annotations

import hashlib
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TYPESAFE_URL = "https://api.typesafe.ai"
VERIFIED = ROOT / "runs" / "jev-verified"      # a hash of the last key that worked


def fingerprint(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def key_from_env_file() -> str:
    env = ROOT / ".env"
    if not env.is_file():
        return ""
    for line in env.read_text().splitlines():
        if line.strip().startswith("TYPESAFE_API_KEY="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def main() -> int:
    key = os.environ.get("TYPESAFE_API_KEY") or key_from_env_file()
    if not key:
        print("no key to check")
        return 2

    from typesafe_sdk import (Noul, TypeSafeAPIConnectionError, TypeSafeAPITimeoutError,
                              TypeSafeAuthenticationError, TypeSafeClient, TypeSafeError,
                              TypeSafePermissionDeniedError)

    started = time.perf_counter()
    try:
        with TypeSafeClient(api_key=key, base_url=TYPESAFE_URL, timeout=20) as client:
            response = client.system_one(
                state={"telegraph": "The ogre raises its club high over its head."},
                questions={"attack": Noul(instructions="Is the opponent about to attack?")},
            )
    except (TypeSafeAuthenticationError, TypeSafePermissionDeniedError):
        print("TypeSafe refused this key. Check it, or create a new one, at")
        print("  https://console.typesafe.ai/login?returnTo=%2Fkeys")
        return 1
    except (TypeSafeAPIConnectionError, TypeSafeAPITimeoutError):
        print("could not reach api.typesafe.ai. Check the network and try again.")
        return 2
    except TypeSafeError as failure:
        print(f"TypeSafe answered with an error: {failure}")
        return 1

    VERIFIED.parent.mkdir(exist_ok=True)
    VERIFIED.write_text(fingerprint(key))
    ms = round((time.perf_counter() - started) * 1000)
    print(f"key works · {response.model} answered in {ms} ms")
    return 0


if __name__ == "__main__":
    sys.exit(main())
