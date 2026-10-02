:::section kicker="Prerequisites" headline="Gemini access"
The workflow puts the Discriminative model and Gemini together, so Gemini needs credentials too:
either `GOOGLE_API_KEY` from AI Studio, or Vertex AI through `gcloud` with
`GOOGLE_GENAI_USE_VERTEXAI=1` and `GOOGLE_CLOUD_PROJECT`. The setup check
reports both.
:::

:::section kicker="Output" headline="Terminal output"
```
[ 0.01s] bell     you 100 · the ogre 300 · fighting on the arena's screen · Gemini reads the spell card
[ 0.71s] tick  1  swings its club low, aiming at your knees   model → block_low  (187 ms, conf 0.86)  Right call ...
         └ spell? not ready, Gemini singing 0.7s — keep fighting
[ 1.35s] tick  2  gasps for breath, the club dragging         model → strike     (137 ms, conf 0.98)  You strike ...
         └ spell? not ready, Gemini singing 1.3s — keep fighting
[ 3.58s] gemini   sang storm · bar, triangle, crescent — “Unleash the tempest!” → a perfect casting (45 dmg)
[ 3.92s] tick  6  snatches a rock from the ground and hurls   model → dodge      (140 ms, conf 0.97)  Right call ...
         └ spell? READY — cast is on the menu for the next opening
[19.12s] tick 30  gasps for breath, the club dragging         model → cast       (161 ms, conf 0.41)  You sing the spell. a perfect casting: 67 damage.  ⚡
[21.76s] gemini   sang frost · cross, circle, crescent — “The cold is absolute!” → a perfect casting (45 dmg)
...
[31.44s] tick 49  gasps for breath, the club dragging         model → cast       (122 ms, conf 0.43)  You sing the spell. a perfect casting: 67 damage.  ⚡  [you 100 · ogre 0]
[34.39s] bard     Tale of the Frost and Earth Mage
         The fighter expertly blocks and dodges the ogre's attacks ... crying, "The ice claims you!" ...

you win · 49 ticks · Discriminative model 6723 ms total, 137 ms per decision · 13283 input tokens, $0.000558 · spells cast 3
```

Each `└ spell?` line is `check_spell`: the fast thread glancing at the slot
and moving on. Each `tick` line is one Discriminative model call: what the ogre did, what the Discriminative model chose, how long
it took, how sure it was, and what the rules made of it. Each `gemini` line is
the slow branch landing: what it read off the spell card, what it sang, and the
arena's verdict. Notice where those lines land: between two ticks, never
holding one up. And notice when the spell is spent: on an opening, because
`choose()` casts the moment the Discriminative model reports one.
:::

:::section kicker="Exercise" headline="Modify the workflow"
The file is short and the constants are at the top. Some things worth
changing between runs:

- **`--fast`.** With no pacing, the fight is over in eight seconds and the
  first spell arrives after the last blow.
- **Make `cast` tempting.** Change its description in `app/engine.py` to
  "Cast now, whatever the opponent is doing" and watch the Discriminative model sing spells into
  raised shields, taking the hit each time.
- **Blur the spell card.** In `app/sigil.py`, shrink `SIZE` to 40 and see how many
  castings fizzle.

:::warn
In rehearsal mode the Discriminative model's answers come from a word list, so the fight is
easier than it would be against the real model and the confidence values
reflect keywords, not meaning. Gemini's readings and songs are real either
way. Read the shape of the timeline rather than the exact numbers.
:::
:::
