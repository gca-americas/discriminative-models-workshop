"""Turn the workbench illustrations into an Apps Script that builds a Google
Slides deck: one slide per illustration, drawn with native, editable shapes.

    npm --prefix web run figures > /tmp/figures.json     # see slides/README.md
    python3 slides/make_appscript.py /tmp/figures.json   # writes slides/Code.gs

Each SVG element becomes a Slides object: rect → (rounded) rectangle, circle →
ellipse, polygon → triangle or diamond, text → text box, line → line (with its
arrowhead), path → short line segments, grouped. Colours are the workbench's
light theme, with each figure in its own step's accent colour. A slide's title
is the heading of the section the figure sits in, and its caption is below.
"""

from __future__ import annotations

import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "slides" / "Code.gs"

# ── colours: the light theme, from web/src/index.css ────────────────────────

def css_tokens() -> dict[str, str]:
    css = (ROOT / "web" / "src" / "index.css").read_text()
    def block(selector: str) -> dict[str, str]:
        start = css.index(selector + " {")
        body = css[start: css.index("\n}", start)]
        return dict(re.findall(r"(--[a-z0-9-]+):\s*([^;]+);", body))
    tokens = block(":root")
    tokens.update(block(':root[data-theme="light"]'))
    return tokens


TOKENS = css_tokens()


def resolve(value: str, accent: str) -> str:
    """var(--x, fallback) → its value, recursively; --accent is the step's colour."""
    def one(match: re.Match) -> str:
        name, fallback = match.group(1), match.group(2)
        if name == "--accent":
            return resolve(f"var(--{accent})", accent)
        if name in TOKENS:
            return resolve(TOKENS[name], accent)
        return fallback.strip() if fallback else "#000000"
    for _ in range(6):
        new = re.sub(r"var\((--[a-z0-9-]+)(?:,\s*([^()]+))?\)", one, value)
        if new == value:
            break
        value = new
    return value.strip()


def parse_colour(value: str | None, accent: str) -> tuple[tuple[float, float, float], float] | None:
    """A CSS colour → ((r, g, b) in 0..1, alpha), or None for none/transparent."""
    if value is None:
        return None
    value = resolve(value, accent)
    if value in ("none", "transparent", ""):
        return None
    if value == "currentColor":
        return parse_colour("var(--fg)", accent)
    mix = re.match(r"color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%,\s*(.+)\)$", value)
    if mix:
        first = parse_colour(mix.group(1), accent)
        share = float(mix.group(2)) / 100
        second = parse_colour(mix.group(3), accent)
        if first is None:
            return None
        if second is None:                      # mixed with transparent: same colour, less opaque
            return first[0], first[1] * share
        rgb = tuple(a * share + b * (1 - share) for a, b in zip(first[0], second[0]))
        return rgb, 1.0
    if value.startswith("#"):
        hexes = value[1:]
        if len(hexes) == 3:
            hexes = "".join(c * 2 for c in hexes)
        return tuple(int(hexes[i:i + 2], 16) / 255 for i in (0, 2, 4)), 1.0
    rgba = re.match(r"rgba?\(([^)]+)\)", value)
    if rgba:
        parts = [p.strip() for p in rgba.group(1).split(",")]
        rgb = tuple(float(p) / 255 for p in parts[:3])
        alpha = float(parts[3]) if len(parts) > 3 else 1.0
        return rgb, alpha
    return (0.0, 0.0, 0.0), 1.0


# ── which figure is where in the course ─────────────────────────────────────

def figure_places() -> list[dict]:
    """Every :::figure in course order, with its step, section heading and caption."""
    import yaml
    places = []
    for folder in sorted((ROOT / "content" / "steps").iterdir()):
        meta = yaml.safe_load((folder / "step.yaml").read_text())
        bodies = [p["body"] for p in meta.get("parts", [])] or ["step.md"]
        for body in bodies:
            text = (folder / body).read_text()
            heading = meta.get("title", "")
            for line in text.splitlines():
                section = re.match(r':::section .*headline="([^"]*)"', line)
                if section:
                    heading = section.group(1)
                figure = re.match(r':::figure id="([^"]+)"(?:.*caption="([^"]*)")?', line)
                if figure and 'src="' not in line:
                    places.append({"id": figure.group(1), "step": meta.get("kicker", ""),
                                   "stepTitle": meta.get("title", ""), "color": meta.get("color", "sky"),
                                   "heading": heading, "caption": figure.group(2) or ""})
    return places


# ── SVG → shapes ────────────────────────────────────────────────────────────

def style_of(element: ET.Element) -> dict[str, str]:
    style = dict(element.attrib)
    for part in (element.get("style") or "").split(";"):
        if ":" in part:
            key, value = part.split(":", 1)
            style[key.strip()] = value.strip()
    return style


def number(value: str | None, default: float = 0.0) -> float:
    try:
        return float(re.sub(r"px$", "", value)) if value is not None else default
    except ValueError:
        return default


def path_points(d: str) -> list[tuple[float, float]]:
    """Absolute M, L, H, V, C, Q commands → a polyline (curves sampled)."""
    tokens = re.findall(r"[MLHVCQZ]|-?\d+(?:\.\d+)?", d)
    points: list[tuple[float, float]] = []
    x = y = 0.0
    i, command = 0, "M"
    def take(n: int) -> list[float]:
        nonlocal i
        values = [float(t) for t in tokens[i:i + n]]
        i += n
        return values
    while i < len(tokens):
        if re.match(r"[A-Z]", tokens[i]):
            command = tokens[i]
            i += 1
            if command == "Z" and points:
                points.append(points[0])
            continue
        if command in ("M", "L"):
            x, y = take(2)
            points.append((x, y))
            if command == "M":
                command = "L"
        elif command == "H":
            (x,) = take(1)
            points.append((x, y))
        elif command == "V":
            (y,) = take(1)
            points.append((x, y))
        elif command == "C":
            x1, y1, x2, y2, x3, y3 = take(6)
            x0, y0 = x, y
            for k in range(1, 11):
                t = k / 10
                bx = (1 - t) ** 3 * x0 + 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3 * x3
                by = (1 - t) ** 3 * y0 + 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3 * y3
                points.append((bx, by))
            x, y = x3, y3
        elif command == "Q":
            x1, y1, x2, y2 = take(4)
            x0, y0 = x, y
            for k in range(1, 9):
                t = k / 8
                points.append(((1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t ** 2 * x2,
                               (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t ** 2 * y2))
            x, y = x2, y2
        else:
            i += 1
    return points


def convert(svg: str, accent: str) -> dict:
    root = ET.fromstring(svg)
    view = [float(v) for v in root.get("viewBox", "0 0 600 300").split()]
    items: list[dict] = []

    def stroke_of(style: dict, opacity: float) -> dict | None:
        colour = parse_colour(style.get("stroke"), accent)
        if colour is None:
            return None
        return {"rgb": colour[0], "alpha": colour[1] * opacity,
                "width": number(style.get("stroke-width"), 1.0),
                "dash": bool(style.get("stroke-dasharray"))}

    def fill_of(style: dict, opacity: float, default: str | None = "#000000") -> dict | None:
        colour = parse_colour(style.get("fill", default), accent)
        if colour is None:
            return None
        return {"rgb": colour[0], "alpha": colour[1] * opacity}

    def walk(element: ET.Element, opacity: float, inherited: dict) -> None:
        tag = element.tag.split("}")[-1]
        style = {**inherited, **{k: v for k, v in style_of(element).items()
                                 if k in ("fill", "stroke", "font-size", "font-weight", "font-family", "text-anchor")}}
        style_here = style_of(element)
        opacity = opacity * number(style_here.get("opacity"), 1.0)
        if tag in ("defs", "marker", "title"):
            return
        if tag == "rect":
            items.append({"kind": "rect", "x": number(element.get("x")), "y": number(element.get("y")),
                          "w": number(element.get("width")), "h": number(element.get("height")),
                          "round": number(element.get("rx")) > 0,
                          "fill": fill_of({**style, **style_here}, opacity),
                          "stroke": stroke_of({**style, **style_here}, opacity)})
        elif tag == "circle":
            r = number(element.get("r"))
            items.append({"kind": "ellipse", "x": number(element.get("cx")) - r, "y": number(element.get("cy")) - r,
                          "w": 2 * r, "h": 2 * r, "round": False,
                          "fill": fill_of({**style, **style_here}, opacity),
                          "stroke": stroke_of({**style, **style_here}, opacity)})
        elif tag == "polygon":
            pts = [tuple(map(float, p.split(","))) for p in element.get("points", "").split()]
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            kind = "diamond" if len(pts) == 4 else "triangle"
            down = kind == "triangle" and sum(ys) / 3 < (max(ys) + min(ys)) / 2  # two points on top: points down
            items.append({"kind": kind, "x": min(xs), "y": min(ys), "w": max(xs) - min(xs), "h": max(ys) - min(ys),
                          "down": down, "round": False,
                          "fill": fill_of({**style, **style_here}, opacity),
                          "stroke": stroke_of({**style, **style_here}, opacity)})
        elif tag == "line":
            stroke = stroke_of({**style, **style_here}, opacity)
            if stroke:
                items.append({"kind": "path", "points": [(number(element.get("x1")), number(element.get("y1"))),
                                                         (number(element.get("x2")), number(element.get("y2")))],
                              "stroke": stroke, "arrow": bool(element.get("marker-end"))})
        elif tag == "path":
            stroke = stroke_of({**style, **style_here}, opacity)
            if stroke:
                items.append({"kind": "path", "points": path_points(element.get("d", "")),
                              "stroke": stroke, "arrow": bool(element.get("marker-end"))})
        elif tag == "text":
            text = "".join(element.itertext())
            if text.strip():
                merged = {**style, **style_here}
                size = number(merged.get("font-size"), 11.0)
                items.append({"kind": "text", "x": number(element.get("x")), "y": number(element.get("y")),
                              "text": text, "size": size,
                              "bold": merged.get("font-weight", "400") in ("600", "700", "bold"),
                              "mono": "monospace" in merged.get("font-family", ""),
                              "anchor": merged.get("text-anchor", "start"),
                              "fill": fill_of(merged, opacity, "var(--fg)")})
            return
        for child in element:
            walk(child, opacity, style)

    for child in root:
        walk(child, 1.0, {})
    return {"view": view, "items": items}


def rounded(value):
    if isinstance(value, float):
        return round(value, 3)
    if isinstance(value, (list, tuple)):
        return [rounded(v) for v in value]
    if isinstance(value, dict):
        return {k: rounded(v) for k, v in value.items()}
    return value


def main() -> int:
    figures = json.loads(Path(sys.argv[1]).read_text())
    places = figure_places()
    seen = set()
    slides = []
    for place in places:
        if place["id"] in figures and place["id"] not in seen:
            seen.add(place["id"])
            slides.append({**place, **convert(figures[place["id"]], place["color"])})
    for figure_id, svg in figures.items():            # drawn but not placed in a step
        if figure_id not in seen:
            slides.append({"id": figure_id, "step": "", "stepTitle": "", "color": "sky",
                           "heading": figure_id.replace("-", " ").capitalize(), "caption": "",
                           **convert(svg, "sky")})
    deck = {"title": "Getting started with Discriminative (Jev/DiffusionGemma) models",
            "subtitle": "Workshop illustrations", "slides": rounded(slides)}
    template = (ROOT / "slides" / "builder.gs").read_text()
    OUT.write_text(template.replace("/*DECK*/null", json.dumps(deck, separators=(",", ":"))))
    print(f"{len(slides)} slides, {sum(len(s['items']) for s in slides)} shapes → {OUT.relative_to(ROOT)}"
          f" ({OUT.stat().st_size // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
