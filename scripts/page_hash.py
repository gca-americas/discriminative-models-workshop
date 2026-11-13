"""A hash of everything the workbench page is built from.

    python3 scripts/page_hash.py           print the hash of the sources
    python3 scripts/page_hash.py --check   exit 0 when web/dist was built from them

The built page ships in the repo (web/dist), so setup does not need Node.
scripts/build_page.sh writes this hash into web/dist/.srchash after a build.
"""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / "web"
SOURCES = ["index.html", "package.json", "package-lock.json", "tsconfig.json", "vite.config.ts"]


def source_hash() -> str:
    digest = hashlib.sha256()
    files = [WEB / name for name in SOURCES] + sorted(p for p in (WEB / "src").rglob("*") if p.is_file())
    files += sorted(p for p in (WEB / "public").rglob("*") if p.is_file()) if (WEB / "public").is_dir() else []
    for path in files:
        if path.is_file():
            digest.update(str(path.relative_to(WEB)).encode())
            digest.update(path.read_bytes())
    return digest.hexdigest()


def main() -> int:
    current = source_hash()
    if "--check" in sys.argv:
        mark = WEB / "dist" / ".srchash"
        built = mark.read_text().strip() if mark.is_file() and (WEB / "dist" / "index.html").is_file() else ""
        return 0 if built == current else 1
    print(current)
    return 0


if __name__ == "__main__":
    sys.exit(main())
