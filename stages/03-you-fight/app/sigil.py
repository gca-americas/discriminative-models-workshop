"""Runes: the spell the screen is showing, drawn as a PNG with no dependencies.

A rune is an element and three glyphs in order. The page shows it; the
spellwright (Gemini) has to read it and sing back the same element and glyphs.
The rune's answer never leaves the server, so a spell is only as good as the
model's eyes.

The rasteriser is deliberately tiny: point-in-shape tests on a grid, zlib for
the PNG. It exists so the workshop's app keeps having no dependencies.
"""

from __future__ import annotations

import math
import random
import struct
import zlib
from typing import Any

ELEMENTS = {
    "fire": (232, 88, 56),
    "frost": (86, 170, 240),
    "earth": (110, 180, 90),
    "storm": (168, 110, 240),
}
GLYPHS = ["circle", "ring", "square", "diamond", "triangle", "cross", "crescent", "bar"]

SIZE = 96              # each glyph cell, in pixels
PAD = 12


def new_sigil(rng: random.Random | None = None) -> dict[str, Any]:
    rng = rng or random.Random()
    return {
        "id": rng.randrange(10_000, 99_999),
        "element": rng.choice(list(ELEMENTS)),
        "glyphs": rng.sample(GLYPHS, 3),
    }


def parse_typed(text: str) -> dict[str, Any]:
    """A spell a person typed, e.g. "frost: circle, bar, square", read into the
    same shape Gemini sings: an element and the glyphs in the order typed.
    Anything else in the text is kept as the incantation."""
    words = [w.strip(".,:;!?\"'()").lower() for w in text.split()]
    element = next((w for w in words if w in ELEMENTS), "")
    glyphs = [w for w in words if w in GLYPHS][:3]
    return {"element": element, "glyphs": glyphs, "incantation": text.strip()[:80]}


def judge(sigil: dict[str, Any], sung: dict[str, Any]) -> dict[str, Any]:
    """How well a sung spell matches the rune. Order matters for the glyphs."""
    element_ok = str(sung.get("element", "")).strip().lower() == sigil["element"]
    sung_glyphs = [str(g).strip().lower() for g in (sung.get("glyphs") or [])][:3]
    matched = sum(1 for want, got in zip(sigil["glyphs"], sung_glyphs) if want == got)
    if element_ok and matched == 3:
        damage, verdict = 45, "a perfect casting"
    elif matched == 3 or (element_ok and matched == 2):
        damage, verdict = 25, "close: the rune half-answers"
    elif matched >= 1 or element_ok:
        damage, verdict = 10, "a sputter: one glyph misread"
    else:
        damage, verdict = 0, "the spell fizzles; nothing on the rune matched"
    return {"damage": damage, "verdict": verdict, "elementOk": element_ok, "glyphsMatched": matched}


# ── drawing ──────────────────────────────────────────────────────────────────

def _inside(glyph: str, u: float, v: float) -> bool:
    """u, v in [-1, 1] across the cell."""
    r = math.hypot(u, v)
    if glyph == "circle":
        return r <= 0.62
    if glyph == "ring":
        return 0.40 <= r <= 0.64
    if glyph == "square":
        return abs(u) <= 0.55 and abs(v) <= 0.55
    if glyph == "diamond":
        return abs(u) + abs(v) <= 0.72
    if glyph == "triangle":
        # apex up
        return v >= -0.55 and v <= 0.62 and abs(u) <= (0.62 - v) * 0.62
    if glyph == "cross":
        return (abs(u) <= 0.16 and abs(v) <= 0.66) or (abs(v) <= 0.16 and abs(u) <= 0.66)
    if glyph == "crescent":
        return r <= 0.62 and math.hypot(u - 0.30, v) > 0.50
    if glyph == "bar":
        return abs(v) <= 0.14 and abs(u) <= 0.68
    return False


def render_png(sigil: dict[str, Any]) -> bytes:
    """The rune as an RGB PNG: three glyphs in a row on a dark card, in the
    element's colour, with a thick border in that colour too."""
    colour = ELEMENTS[sigil["element"]]
    width = PAD * 2 + SIZE * 3
    height = PAD * 2 + SIZE
    bg, border = (16, 20, 34), colour
    rows = []
    for y in range(height):
        row = bytearray([0])                       # filter byte: none
        for x in range(width):
            on_border = x < 6 or y < 6 or x >= width - 6 or y >= height - 6
            if on_border:
                row.extend(border)
                continue
            cell = (x - PAD) // SIZE
            if 0 <= cell < 3 and PAD <= y < PAD + SIZE:
                cx = PAD + cell * SIZE + SIZE / 2
                cy = PAD + SIZE / 2
                u, v = (x - cx) / (SIZE / 2), (cy - y) / (SIZE / 2)
                row.extend(colour if _inside(sigil["glyphs"][cell], u, v) else bg)
            else:
                row.extend(bg)
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
            + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))


def describe(sigil: dict[str, Any]) -> str:
    """The rune in words, for a terminal that cannot show an image."""
    return f"a {sigil['element']} rune: {', '.join(sigil['glyphs'])}"


if __name__ == "__main__":
    import sys
    s = new_sigil(random.Random(int(sys.argv[1]) if len(sys.argv) > 1 else None))
    sys.stdout.buffer.write(render_png(s))
    print(describe(s), file=sys.stderr)
