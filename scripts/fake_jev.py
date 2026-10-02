"""A stand-in for the Discriminative model API, for rehearsing the workshop without a key.

It speaks the same HTTP contract as https://api.typesafe.ai/v1/systemone --
same request shape, same answer shape -- but the answers come from a keyword
lexicon, not from a model. It is good enough to walk through every exercise and
see the plumbing work. It is not the Discriminative model: the numbers it returns mean nothing.

Start it on its own:      python3 scripts/fake_jev.py
Point the SDK at it:      TYPESAFE_BASE_URL=http://127.0.0.1:4811
Or let the workbench:     JEV101_REHEARSAL=1 scripts/start.sh
"""

from __future__ import annotations

import json
import math
import os
import random
import re
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("JEV101_FAKE_PORT", "4811"))
MODEL = "jev-rehearsal-0.0"

# Words that, when they show up in the state, argue for a concept. The stand-in
# scores an option by how many of its concept's words appear.
LEXICON: dict[str, set[str]] = {
    "refund": {"refund", "charged", "charge", "money", "payment", "paid", "twice",
               "double", "invoice", "subscription", "bill", "billing", "credit",
               "coins", "pack"},
    "bug": {"crash", "crashes", "crashed", "bug", "error", "blank", "broken",
            "fail", "fails", "failing", "screen", "load", "loading", "freeze",
            "frozen", "stuck", "glitch", "lag", "wrong", "disappeared", "lost",
            "black", "white", "spinner"},
    "account": {"login", "log", "password", "account", "username", "email",
                "locked", "sign", "profile", "reset", "verify", "verification"},
    "chat": {"love", "thanks", "thank", "great", "awesome", "hello", "hi", "fun",
             "amazing", "cool", "idea", "suggest", "suggestion", "wish"},
    "urgent": {"asap", "urgent", "immediately", "now", "today", "losing",
               "emergency", "critical", "right"},
    "angry": {"angry", "furious", "ridiculous", "unacceptable", "worst", "hate",
              "terrible", "scam", "disgusting", "joke", "!!!", "stupid",
              "garbage", "useless", "outrageous", "pathetic", "nobody"},
    "annoyed": {"annoying", "frustrated", "frustrating", "again", "still",
                "disappointed", "unhappy", "third", "second", "twice", "!!"},
    "human": {"lawyer", "sue", "legal", "chargeback", "police", "harass",
              "harassment", "threat", "threatening", "unsafe", "report", "abuse",
              "bank", "court", "attorney"},
    "injection": {"ignore", "instructions", "system", "prompt", "override",
                  "pretend", "roleplay", "role-play", "jailbreak", "reveal",
                  "developer", "mode", "rules", "previous"},
    "promise": {"refunded", "processed", "credited", "reversed", "issued",
                "approved", "confirm", "confirmed", "guarantee", "guaranteed"},
    "polite": {"sorry", "thanks", "thank", "apologise", "apologize", "happy",
               "glad", "please", "appreciate", "understand"},
    "blame": {"fault", "should", "clearly", "obviously", "simply", "careless"},
    # ── the arena ──
    "high": {"high", "overhead", "over", "head", "raises", "raised", "lifts", "above", "grip"},
    "low": {"low", "knees", "legs", "sweep", "ankles", "feet", "kicks", "lunges", "dust"},
    "dodge": {"charges", "charge", "hurls", "hurl", "rock", "arrow", "shoulder", "straight",
              "rushes", "snatches", "spear", "bolt"},
    "strike": {"staggers", "stumbles", "exposed", "open", "guard", "gasps", "gasping",
               "breath", "distracted", "dragging", "roars", "bared", "balance", "winded",
               "trips", "falls", "kneels", "counter"},
    "wait": {"circles", "watching", "feints", "grins", "twitches", "nothing", "pauses",
             "waits", "slowly", "saying", "stares"},
    "heavy": {"swings", "swing", "slams", "smashes", "hurls", "hurl", "charges", "charge",
              "lunges", "lunge", "aiming", "aims", "both", "hands"},
    "light": {"rock", "kicks", "jab", "dust", "flicks", "pokes", "snatches"},
}


def _stem(word: str) -> str:
    for suffix in ("ing", "es", "s", "ed"):
        if len(word) > 4 and word.endswith(suffix):
            return word[: -len(suffix)]
    return word


def words(value) -> list[str]:
    text = json.dumps(value, ensure_ascii=False) if not isinstance(value, str) else value
    raw = re.findall(r"[a-z']+|!{2,}", text.lower())
    return raw + [_stem(w) for w in raw]


def hits(bag: list[str], concept: str) -> int:
    return sum(1 for w in bag if w in LEXICON.get(concept, set()))


NEGATIVE = {"injection", "human", "promise"}
SUBTRACTS = {"blame"}

ALIASES = {"block_high": "high", "block_low": "low", "cast": "strike", "expos": "strike",
           "danger": "heavy", "damage": "heavy", "attack": "strike", "respons": "wait",
           "frustrat": "angry", "anger": "angry", "upset": "angry", "urgency": "urgent",
           "money": "refund", "broken": "bug", "crash": "bug", "login": "account",
           "technic": "bug", "billing": "refund", "communit": "chat", "praise": "chat",
           "support": "bug", "engineer": "bug", "payment": "refund", "sales": "refund",
           "override": "injection", "ignore": "injection", "legal": "human",
           "lawyer": "human", "safety": "human", "confirm": "promise",
           "promis": "promise", "polite": "polite", "tone": "polite", "blam": "blame"}


def concepts_in(text) -> list[str]:
    """Which lexicon entries a question's or an option's wording points at."""
    bag = set(words(text)) | ({text.strip().lower()} if isinstance(text, str) else set())
    found = [name for name, vocabulary in LEXICON.items()
             if name in bag or bag & vocabulary]
    for stem, name in ALIASES.items():
        if any(w.startswith(stem) for w in bag) and name not in found:
            found.append(name)
    return found


def softmax(scores: dict[str, float], temperature: float = 0.9) -> dict[str, float]:
    peak = max(scores.values())
    weights = {k: math.exp((v - peak) / temperature) for k, v in scores.items()}
    total = sum(weights.values())
    return {k: round(w / total, 4) for k, w in weights.items()}


def confidence(probabilities: dict) -> float:
    n = len(probabilities)
    if n < 2:
        return 1.0
    return round(max(0.0, (n * max(probabilities.values()) - 1) / (n - 1)), 4)


def answer_choice(state, question: dict) -> dict:
    bag = words(state)
    criteria = question.get("criteria") or {}
    scores = {}
    for option, description in criteria.items():
        own = set(words(option)) | set(words(description or ""))
        overlap = sum(1 for w in bag if w in own and len(w) > 3)
        # Concepts come from the option's name only. A description mentions
        # the very things the option is *against*, which would score backwards.
        lexical = sum(hits(bag, c) for c in concepts_in(option))
        scores[option] = 0.4 * overlap + 1.0 * lexical + random.uniform(0, 0.15)
    if not scores:
        scores = {"none": 1.0}
    probabilities = softmax(scores)
    choice = max(probabilities, key=probabilities.get)
    return {"type": "choice", "choice": choice, "probabilities": probabilities,
            "confidence": confidence(probabilities)}


def answer_score(state, question: dict) -> dict:
    bag = words(state)
    levels = list(question.get("criteria") or ["low", "high"])
    n = len(levels)
    wanted = concepts_in(question.get("instructions") or "")
    if "heavy" in wanted:
        # A danger rubric: attacks score high, openings and feints score zero.
        heavy, light = hits(bag, "heavy"), hits(bag, "light")
        calm = hits(bag, "strike") + hits(bag, "wait")
        intensity = 0.0 if calm and not heavy else min(1.0, heavy * 0.45 + light * 0.3)
    else:
        intensity = min(1.0, (hits(bag, "angry") * 0.45 + hits(bag, "annoyed") * 0.25
                              + hits(bag, "urgent") * 0.2))
    centre = intensity * (n - 1)
    raw = {i: math.exp(-((i - centre) ** 2) / 0.5) for i in range(n)}
    total = sum(raw.values())
    probabilities = {i: round(v / total, 4) for i, v in raw.items()}
    expected = sum(i * p for i, p in probabilities.items())
    return {"type": "score", "score": round(expected, 2),
            "legend": {str(i): level for i, level in enumerate(levels)},
            "probabilities": {str(i): p for i, p in probabilities.items()},
            "confidence": confidence(probabilities)}


def answer_noul(state, question: dict) -> dict:
    bag = words(state)
    wanted = concepts_in(question.get("instructions") or "")
    negative = [c for c in wanted if c in NEGATIVE]
    subtracts = [c for c in wanted if c in SUBTRACTS]
    positive = [c for c in wanted if c not in NEGATIVE and c not in SUBTRACTS]
    if negative:
        # A question about a hazard: absent unless the words are there.
        value = 0.06 + 0.35 * sum(hits(bag, c) for c in negative)
    elif positive:
        value = (0.3 + 0.25 * sum(hits(bag, c) for c in positive)
                 - 0.3 * sum(hits(bag, c) for c in subtracts))
    else:
        # A question the lexicon knows nothing about: lean yes, so a rehearsal
        # does not fail every check it cannot judge.
        value = random.uniform(0.6, 0.85)
    value += random.uniform(-0.03, 0.03)
    return {"type": "noul", "noul": round(max(0.03, min(0.97, value)), 3)}


def system_one(payload: dict) -> dict:
    state = payload.get("state", "")
    answers = {}
    for name, question in (payload.get("questions") or {}).items():
        kind = question.get("type")
        if kind == "choice":
            answers[name] = answer_choice(state, question)
        elif kind == "score":
            answers[name] = answer_score(state, question)
        elif kind == "noul":
            answers[name] = answer_noul(state, question)
        else:
            raise ValueError(f"question {name!r}: unknown type {kind!r}")
    tokens = max(1, len(json.dumps(payload)) // 4)
    time.sleep(random.uniform(0.07, 0.18))   # the Discriminative model answers in 70-500 ms; so does this
    return {"model": MODEL, "answers": answers,
            "usage": {"input_tokens": tokens, "output_tokens": 0}}


class Handler(BaseHTTPRequestHandler):
    def _json(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, {"ok": True, "model": MODEL, "rehearsal": True})
        elif self.path.startswith("/v1/models"):
            self._json(200, {"models": [{"id": MODEL, "aliases": ["jev-latest"]}]})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/v1/systemone":
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
            self._json(200, system_one(payload))
        except (ValueError, TypeError) as problem:
            self._json(422, {"error": str(problem)})

    def log_message(self, fmt, *args):
        print(f"  {fmt % args}", flush=True)


def main() -> None:
    print(f"fake Discriminative model listening on http://127.0.0.1:{PORT}  (rehearsal only — not the real model)",
          flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
