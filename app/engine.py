"""The arena: the rules of the fight.

One file, imported by the arena server, the terminal scripts and the ADK
workflow, so there is exactly one copy of the rules. Nothing here talks to a
model.

A fight is a loop. Each tick the opponent *telegraphs* a move as a line of
text, something responds, and code resolves the tick. In step 3 a person
responds; later steps hand the same decision to a model.

The ogre is big on purpose. Blocks and counters keep you alive; they do not
win. Winning takes spells, and a spell has to match the spell card on the
screen.
"""

from __future__ import annotations

import random
from typing import Any

import sigil

OPPONENT = {
    "name": "the Ogre",
    "description": "a nine-foot ogre with a spiked club, thick hide, and a short temper",
}

YOU_HP = 100
FOE_HP = 300
MAX_TICKS = 60
REACTION_SECONDS = 2.0        # how long a person gets to read a telegraph

# Every telegraph has a right answer the engine knows and the player does not.
# `counter` is what avoids or punishes the move; `danger` is how hard it hits
# if you get it wrong (0 means it is not an attack at all).
MOVES: list[dict[str, Any]] = [
    {"id": "overhead", "telegraph": "The ogre raises its club high over its head, both hands on the grip.",
     "counter": "block_high", "danger": 2, "opening": False},
    {"id": "low_sweep", "telegraph": "The ogre swings its club low, aiming at your knees.",
     "counter": "block_low", "danger": 2, "opening": False},
    {"id": "charge", "telegraph": "The ogre lowers its shoulder and charges straight at you.",
     "counter": "dodge", "danger": 2, "opening": False},
    {"id": "rock", "telegraph": "The ogre snatches a rock from the ground and hurls it at your chest.",
     "counter": "dodge", "danger": 1, "opening": False},
    {"id": "kick", "telegraph": "The ogre kicks dust in the air and lunges low at your legs.",
     "counter": "block_low", "danger": 1, "opening": False},
    {"id": "stagger", "telegraph": "The ogre staggers, off balance, its guard wide open.",
     "counter": "strike", "danger": 0, "opening": True},
    {"id": "roar", "telegraph": "The ogre throws its head back and roars at the sky, chest bared.",
     "counter": "strike", "danger": 0, "opening": True},
    {"id": "winded", "telegraph": "The ogre gasps for breath, the club dragging on the ground.",
     "counter": "strike", "danger": 0, "opening": True},
    {"id": "circle", "telegraph": "The ogre circles you slowly, watching, saying nothing.",
     "counter": "wait", "danger": 0, "opening": False},
    {"id": "feint", "telegraph": "The ogre twitches the club upward, then grins and does nothing.",
     "counter": "wait", "danger": 0, "opening": False},
]

RESPONSES = {
    "block_high": "Raise the shield. Right against an overhead or a high swing.",
    "block_low": "Drop the shield. Right against a swing or lunge at the legs.",
    "dodge": "Step aside. Right against a charge or a thrown object.",
    "strike": "Attack now. Right when the opponent is exposed; costly during its attack.",
    "wait": "Hold and watch. Right against a feint, or when nothing is happening.",
}
CAST = "Cast the spell that is ready. It always lands; it lands hardest when the opponent is exposed."

# The rules, as a person reads them before the fight. Same facts as MOVES.
RULES = [
    ("club high over its head", "block high", "heavy hit"),
    ("swings low at your knees", "block low", "heavy hit"),
    ("lowers its shoulder and charges", "dodge", "heavy hit"),
    ("hurls a rock", "dodge", "light hit"),
    ("kicks dust and lunges low", "block low", "light hit"),
    ("staggers, guard open", "strike", "an opening"),
    ("roars at the sky", "strike", "an opening"),
    ("gasps for breath", "strike", "an opening"),
    ("circles you", "wait", "nothing"),
    ("twitches the club, then grins", "wait", "a feint"),
]

STRIKE_DAMAGE = 8             # small on purpose: reflexes alone cannot win
COUNTER_DAMAGE = 3


# ── the rules ────────────────────────────────────────────────────────────────

def resolve(move: dict[str, Any], action: str, spell: dict[str, Any] | None) -> dict[str, Any]:
    """What happens when a response meets a telegraph. Plain rules."""
    took = dealt = 0
    spell_used = False
    danger = move["danger"]
    hit = danger * 12

    if action == "cast" and spell:
        dealt = int(spell.get("damage", 0))
        if move["opening"]:
            dealt = int(dealt * 1.5)
        spell_used = True
        took = hit                      # casting through an attack still hurts
        text = f"You sing the spell. {spell.get('verdict', 'It lands')}: {dealt} damage."
        if took:
            text += f" The ogre's blow lands too: {took}."
    elif action == "cast":
        text = "You raise your hand to cast, but no spell is ready. Nothing happens."
    elif move["opening"]:
        if action == "strike":
            dealt = STRIKE_DAMAGE
            text = f"You strike into the opening for {dealt}. The hide is thick."
        else:
            text = "The opening passes. Nothing happens."
    elif danger == 0:
        if action == "strike":
            dealt, took = 2, 5
            text = "You lunge at nothing; a glancing 2, and you eat a jab for 5."
        else:
            text = "You hold. Nothing happens."
    elif action == move["counter"]:
        dealt = COUNTER_DAMAGE
        text = f"Right call: {action.replace('_', ' ')}. The move fails and you counter for {dealt}."
    elif action == "dodge" and move["counter"].startswith("block"):
        took = hit // 2
        text = f"You dodge late and catch half of it: {took}."
    elif action == "strike":
        took, dealt = hit, 3
        text = f"You trade: your strike lands for 3, the ogre's for {took}."
    else:
        took = hit
        text = f"Wrong call: {action.replace('_', ' ')} against that. You take {took}."

    return {"took": took, "dealt": dealt, "text": text, "spell_used": spell_used}


class Fight:
    """The state of one fight. The engine is deterministic given its seed."""

    def __init__(self, seed: int | None = None, mode: str = "manual"):
        self.rng = random.Random(seed)
        self.mode = mode
        self.you = YOU_HP
        self.foe = FOE_HP
        self.tick = 0
        self.log: list[dict[str, Any]] = []
        self._last: str | None = None
        # the spell side
        self.sigil = sigil.new_sigil(self.rng)
        self.spell: dict[str, Any] | None = None     # a sung spell, ready to cast
        self.spell_status = "none"                   # none | forging | ready
        self.castings: list[dict[str, Any]] = []     # every spell sung, judged
        self.paused = False                          # the page's Pause
        self.extra: dict[str, Any] = {}              # fields a plugin mode adds to the snapshot

    def next_move(self) -> dict[str, Any]:
        candidates = [m for m in MOVES if m["id"] != self._last]
        # Attacks are common; openings get a little more likely as the ogre tires.
        weights = [3.0 if m["danger"] else (2.0 if m["opening"] and self.foe < FOE_HP * 0.5 else 1.2)
                   for m in candidates]
        move = self.rng.choices(candidates, weights=weights)[0]
        self._last = move["id"]
        return move

    @property
    def over(self) -> bool:
        return self.you <= 0 or self.foe <= 0 or self.tick >= MAX_TICKS

    @property
    def result(self) -> str:
        if self.foe <= 0:
            return "you win"
        if self.you <= 0:
            return "the ogre wins"
        return "draw: the ogre lumbers off, barely scratched"

    def sing(self, sung: dict[str, Any]) -> dict[str, Any]:
        """A spell sung at the current rune. Judged here, where the answer lives."""
        verdict = sigil.judge(self.sigil, sung)
        spell = {**verdict, "incantation": sung.get("incantation", ""),
                 "element": sung.get("element"), "glyphs": sung.get("glyphs"),
                 "rune": self.sigil["id"]}
        self.castings.append(spell)
        self.spell = spell if verdict["damage"] > 0 else None
        self.spell_status = "ready" if self.spell else "none"
        if not self.spell:
            self.sigil = sigil.new_sigil(self.rng)     # a fizzle burns the rune too
        return spell

    def apply(self, move: dict[str, Any], decision: dict[str, Any]) -> dict[str, Any]:
        outcome = resolve(move, decision["action"], self.spell)
        self.tick += 1
        self.you = max(0, self.you - outcome["took"])
        self.foe = max(0, self.foe - outcome["dealt"])
        entry = {"tick": self.tick, "telegraph": move["telegraph"], **decision, **outcome,
                 "you": self.you, "foe": self.foe}
        if outcome["spell_used"]:
            entry["spell"] = self.spell
            self.spell = None
            self.spell_status = "none"
            self.sigil = sigil.new_sigil(self.rng)     # the screen draws a new rune
        self.log.append(entry)
        return entry

    def snapshot(self) -> dict[str, Any]:
        return {"mode": self.mode, "tick": self.tick, "you": self.you, "foe": self.foe,
                "over": self.over, "result": self.result if self.over else None,
                "max": {"you": YOU_HP, "foe": FOE_HP, "ticks": MAX_TICKS},
                "sigil": {"id": self.sigil["id"]},                 # never the answer
                "spellStatus": self.spell_status, "spell": self.spell, "paused": self.paused,
                "castings": self.castings[-6:], "reactionSeconds": REACTION_SECONDS, **self.extra}
