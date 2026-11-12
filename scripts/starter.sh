#!/usr/bin/env bash
# Put the exercise files back the way the workshop ships them, with their TODO
# lines, from the copies in starter/. Your edits to these files are lost:
#
#   scripts/first_call.py       step 5a, the first request
#   branches/read_card.py       step 6b, reading the spell card
#   branches/fight_loop.py      step 6b, the fight loop
#
# It also selects spell card 1 again and puts the arena app back in manual mode.
#
#   scripts/starter.sh          reset all of them
#   scripts/starter.sh FILE...  reset only these, e.g. branches/fight_loop.py
set -euo pipefail
cd "$(dirname "$0")/.."

FILES=(scripts/first_call.py branches/read_card.py branches/fight_loop.py)
[ $# -gt 0 ] && FILES=("$@")

for f in "${FILES[@]}"; do
    if [ ! -f "starter/$f" ]; then
        echo "  ! no starter copy of $f"
        continue
    fi
    mkdir -p "$(dirname "$f")"
    cp "starter/$f" "$f"
    echo "  ✓ $f"
done

if [ $# -eq 0 ]; then
    cp branches/cards/card1.png branches/spell_card.png
    cp branches/cards/card1.json branches/spell_card.json
    echo "  ✓ spell card 1 selected"
    .venv/bin/python scripts/stage.py 3 > /dev/null && echo "  ✓ arena app in manual mode"
fi
