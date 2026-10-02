"""Ask the Discriminative model your own question about one of the ogre's moves.

    python3 scripts/ask.py "Is the ogre about to hit high?"
    python3 scripts/ask.py "What should I do?" --choice "block_high,block_low,dodge,strike,wait"
    python3 scripts/ask.py "How dangerous is this?" --score "harmless,light hit,heavy hit"
    python3 scripts/ask.py "..." --move 6              (pick another telegraph; 1-10)
    python3 scripts/ask.py "..." --text "The ogre throws sand in your eyes."

A question with no --choice or --score is a yes/no question (a noul).
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from jev_common import bar, cost_line, load_env, moves, opponent, jev_client  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("question", help="what to ask about the telegraph")
    parser.add_argument("--choice", help="comma-separated options: makes it a choice question")
    parser.add_argument("--score", help="comma-separated ordered levels: makes it a score question")
    parser.add_argument("--move", type=int, default=1, help="which telegraph, 1-10 (default 1)")
    parser.add_argument("--text", help="use this text as the telegraph instead")
    args = parser.parse_args()

    load_env()
    from typesafe_sdk import Choice, Noul, Score, TypeSafeClient, TypeSafeError

    if args.text:
        text = args.text
    else:
        found = [m for m in moves() if m["id"] == args.move]
        if not found:
            print(f"there is no move #{args.move}; the ogre has {len(moves())}")
            return 2
        text = found[0]["telegraph"]

    if args.choice:
        options = [o.strip() for o in args.choice.split(",") if o.strip()]
        question = Choice(instructions=args.question, criteria={o: None for o in options})
        kind = "choice"
    elif args.score:
        levels = [l.strip() for l in args.score.split(",") if l.strip()]
        question = Score(instructions=args.question, criteria=levels)
        kind = "score"
    else:
        question = Noul(instructions=args.question)
        kind = "noul"

    print(f"telegraph {text}")
    print(f"question  {args.question}   [{kind}]")
    print()

    started = time.perf_counter()
    try:
        with jev_client() as client:
            response = client.system_one(
                state={"opponent": opponent()["description"], "telegraph": text},
                questions={"answer": question},
            )
    except TypeSafeError as failure:
        print(f"The Discriminative model did not answer: {failure}")
        return 1
    elapsed_ms = round((time.perf_counter() - started) * 1000)

    answer = response.answers["answer"]
    if kind == "noul":
        print(f"  yes  {bar(answer.noul)}  {answer.noul:.2f}")
        print(f"  no   {bar(1 - answer.noul)}  {1 - answer.noul:.2f}")
    elif kind == "choice":
        for option, p in sorted(answer.probabilities.items(), key=lambda kv: -kv[1]):
            mark = "→" if option == answer.choice else " "
            print(f"{mark} {option:<14} {bar(p)}  {p:.2f}")
        print(f"\n  choice {answer.choice} · confidence {answer.confidence:.2f}")
    else:
        for level, p in answer.probabilities.items():
            print(f"  {level}  {answer.legend[level]:<24} {bar(p)}  {p:.2f}")
        print(f"\n  score {answer.score:.2f} on 0–{len(answer.legend) - 1} · confidence {answer.confidence:.2f}")

    print(f"\n{elapsed_ms} ms · {cost_line(response)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
