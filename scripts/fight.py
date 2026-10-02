"""A whole fight in the terminal, the Discriminative model only: one call per tick, no Gemini.

    python3 scripts/fight.py             a fresh fight
    python3 scripts/fight.py --seed 7    the same fight every time
    python3 scripts/fight.py --moves     just list the ogre's telegraphs

Same rules and same questions as the arena app (app/engine.py), so there is
one copy to review. What this adds is the shape of it at speed: sixty ticks,
sixty calls, and the time and money they took. And the lesson: reflexes keep
you alive, and the ogre still walks away.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "app"))
from jev_common import PRICE_PER_MILLION_INPUT_TOKENS, load_env, jev_client  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seed", type=int, help="make the ogre predictable")
    parser.add_argument("--moves", action="store_true", help="list the telegraphs and stop")
    args = parser.parse_args()

    load_env()
    import engine
    try:
        import reflex
    except ImportError:
        print("The arena app has no Discriminative model fight yet. Add it first:\n"
              "  python3 scripts/stage.py 5")
        return 2
    from typesafe_sdk import TypeSafeClient, TypeSafeError

    if args.moves:
        for i, move in enumerate(engine.MOVES, 1):
            tag = "opening" if move["opening"] else f"danger {move['danger']}"
            print(f"{i:>2}  {move['telegraph']:<72} → {move['counter']:<10} ({tag})")
        return 0

    fight = engine.Fight(seed=args.seed, mode="model")
    print(f"{'#':>2}  {'the ogre…':<44} {'model says':<11} {'conf':>4}  {'expo':>4}  {'dngr':>4}  {'ms':>4}  outcome")
    print("-" * 110)
    total_ms = total_tokens = 0
    started_all = time.perf_counter()

    with jev_client() as client:
        while not fight.over:
            move = fight.next_move()
            started = time.perf_counter()
            try:
                response = client.system_one(
                    state={"opponent": engine.OPPONENT["description"], "telegraph": move["telegraph"]},
                    questions=reflex.reflex_questions(spell_ready=False),
                )
            except TypeSafeError as failure:
                print(f"The Discriminative model did not answer: {failure}")
                return 1
            ms = round((time.perf_counter() - started) * 1000)
            total_ms += ms
            total_tokens += response.usage.input_tokens or 0

            decision = reflex.choose(response.answers, spell_ready=False)
            entry = fight.apply(move, decision)
            short = move["telegraph"].replace("The ogre ", "").rstrip(".")
            said = decision["action"] + ("*" if decision["fallback"] else "")
            print(f"{entry['tick']:>2}  {short[:44]:<44} {said:<11} {decision['confidence']:>4.2f}  "
                  f"{decision['exposed']:>4.2f}  {decision['danger']:>4.2f}  {ms:>4}  "
                  f"{entry['text']}  [you {entry['you']} · ogre {entry['foe']}]")

    wall = time.perf_counter() - started_all
    print("-" * 110)
    print(f"{fight.result}. {fight.tick} ticks in {wall:.1f} s wall · Discriminative model {total_ms} ms total, "
          f"{total_ms // max(1, fight.tick)} ms per tick · {total_tokens} input tokens · "
          f"${total_tokens * PRICE_PER_MILLION_INPUT_TOKENS / 1_000_000:.6f}")
    print("* = The Discriminative model's confidence was low against a heavy hit, so the code chose to dodge")
    return 0


if __name__ == "__main__":
    sys.exit(main())
