"""Run the arena workflow and watch two speeds at once.

    python3 scripts/arena.py               one fight
    python3 scripts/arena.py --seed 7      a repeatable ogre
    python3 scripts/arena.py --fast        no pacing between ticks

If the arena app is running (step 3), the workflow plays on its screen and
this prints the same fight as a timeline. If not, it plays in this process.
Every line is stamped with seconds since the bell. The Discriminative model's ticks arrive every
few hundred milliseconds; a sung spell arrives whenever Gemini has read the
spell card, and the next tick can cast it.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import textwrap
import time
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "scripts"))
from jev_common import PRICE_PER_MILLION_INPUT_TOKENS, load_env  # noqa: E402

warnings.filterwarnings("ignore")
os.environ.setdefault("GRPC_VERBOSITY", "ERROR")


def gemini_ready() -> bool:
    vertex = os.environ.get("GOOGLE_GENAI_USE_VERTEXAI", "").lower() in ("1", "true")
    if vertex and os.environ.get("GOOGLE_CLOUD_PROJECT"):
        os.environ.setdefault("GOOGLE_CLOUD_LOCATION", "global")
        return True
    return bool(os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"))


def text_of(event) -> str:
    if not event.content or not event.content.parts:
        return ""
    return "".join(p.text or "" for p in event.content.parts if p.text and not getattr(p, "thought", False))


async def run(seed: int | None) -> None:
    from google.adk.runners import InMemoryRunner
    from google.genai import types

    from agents.arena.agent import root_agent

    runner = InMemoryRunner(agent=root_agent, app_name="arena")
    session = await runner.session_service.create_session(
        app_name="arena", user_id="workshop", state={"seed": seed} if seed is not None else None)
    bell = time.perf_counter()
    stamp = lambda: f"[{time.perf_counter() - bell:5.2f}s]"

    content = types.Content(role="user", parts=[types.Part(text="fight")])
    async for event in runner.run_async(user_id="workshop", session_id=session.id, new_message=content):
        delta = event.actions.state_delta or {}
        if "arena" in delta:
            where = "on the arena's screen" if delta["arena"] == "screen" else "in this process (no app running)"
            print(f"{stamp()} bell     you 100 · the ogre 300 · fighting {where} · Gemini reads the spell card")
        if "last" in delta:
            e = delta["last"]
            said = e["action"] + ("*" if e.get("fallback") else "")
            short = e["telegraph"].replace("The ogre ", "").rstrip(".")
            cast = "  ⚡" if e["spell_used"] else ""
            print(f"{stamp()} tick {e['tick']:>2}  {short[:40]:<40} model → {said:<11} "
                  f"({e['ms']} ms, conf {e['confidence']:.2f})  {e['text']}{cast}  "
                  f"[you {e['you']} · ogre {e['foe']}]")
        if "spell_check" in delta:
            c = delta["spell_check"]
            if c["ready"]:
                print(f"         └ spell? READY — cast is on the menu for the next opening")
            else:
                waited = f", Gemini singing {c['waited']}s" if c.get("waited") is not None else ""
                print(f"         └ spell? not ready{waited} — keep fighting")
        if "last_song" in delta:
            s = delta["last_song"]
            print(f"{stamp()} gemini   sang {s['element']} · {', '.join(s['glyphs'] or [])} — "
                  f"“{s['incantation']}” → {s['verdict']} ({s['damage']} dmg)"
                  + (" · `cast` joins the Discriminative model's options" if s["damage"] else ""))
        if event.author == "bard" and text_of(event).strip():
            try:
                tale = json.loads(text_of(event))
            except ValueError:
                tale = {"title": "", "tale": text_of(event)}
            print(f"{stamp()} bard     {tale.get('title', '')}")
            for line in textwrap.wrap(tale.get("tale", ""), 78):
                print(f"         {line}")

    final = await runner.session_service.get_session(app_name="arena", user_id="workshop",
                                                     session_id=session.id)
    tokens = int(final.state.get("jev_tokens", 0))
    ticks = int(final.state.get("tick", 0))
    print()
    print(f"{final.state.get('result', '?')} · {ticks} ticks · Discriminative model {final.state.get('jev_ms', 0)} ms total, "
          f"{final.state.get('jev_ms', 0) // max(1, ticks)} ms per decision · {tokens} input tokens, "
          f"${tokens * PRICE_PER_MILLION_INPUT_TOKENS / 1_000_000:.6f} · spells cast {final.state.get('spells_cast', 0)}")
    print("* = low confidence against a heavy hit; the code chose to dodge")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seed", type=int)
    parser.add_argument("--fast", action="store_true", help="no pause between ticks")
    args = parser.parse_args()

    load_env()
    if args.fast:
        os.environ["JEV101_TICK_SECONDS"] = "0"
    if not gemini_ready():
        print("Gemini is not set up. Put GOOGLE_API_KEY=... in .env, or set")
        print("GOOGLE_GENAI_USE_VERTEXAI=1 and GOOGLE_CLOUD_PROJECT=... (with gcloud auth).")
        print("`python3 scripts/check_setup.py` shows the current state.")
        return 2
    asyncio.run(run(args.seed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
