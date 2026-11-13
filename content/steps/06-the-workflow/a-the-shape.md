:::section kicker="Limitation" headline="Limits of per-tick decisions"
Step 5 ended in a draw. The model read every move and took no damage, and
the ogre was still standing at tick 45.

The numbers explain it. The ogre has 300 hit points. A right call counters
for 3, and a strike into an opening does 8, because the hide is thick.
Forty-five ticks of good decisions do not add up to 300.

Only a spell does real damage: 45 for a perfect casting, 67 when it lands on
an opening. The spell card in the corner of the ring has been there the whole
time. Reading it takes a model that can see an image.

:::figure id="per-tick-limits" src="per-tick-limits.png" caption="A step 5 fight. The spell card is in the corner of the ring from the first tick, and nothing reads it."
:::
:::

:::section kicker="Design" headline="Assign each task to the right model"
The spell card in the corner of the ring is the way to win. It is a picture:
a color and three shapes in a row. The color is one of four and each shape is
one of eight, so reading the card is a bounded decision too. It needs a
decision model that takes images, and Gemini Decisions does.

The workflow gives each task to the model that fits it:

- **Your decision model fights.** Every tick, one call, one decision. This is
  the model you chose in step 2, with the same questions as step 5. The loop
  never waits for the card.
- **Gemini Decisions reads the spell card.** In the background, starting at
  the bell, the workflow takes the card off the arena's screen as an image
  and asks four choice questions about it: the color, and the shape in each
  position. The arena judges the reading against the card's answer, which
  never leaves the server. After each cast a new card appears, and the card
  reader reads that one too.
- **Code holds the rules.** `choose()` casts the spell the moment the model
  reports an opening. The words of the spell are a fixed line per element,
  because a decision model picks from options and does not write.
- **Gemini writes a short tale** once, at the end. That is the only
  open-ended text in the fight, so it is the only call to a language model.

:::figure id="arena-graph" caption="The fight loops on its own. The card is read beside it and the spell arrives through state. Gemini writes the tale when the fight ends."
:::
:::

:::section kicker="Architecture" headline="A loop, and a card reader alongside it"
This is an ADK **Workflow**: a graph of nodes joined by edges. A node is a
plain Python function or an LLM agent. An edge from one node to a *tuple* of
nodes is a fan-out: both start, at the same time. A node that returns an
`Event` with a `route` picks which edge is taken next, and a node that routes
to itself is a loop.

At the bell the graph fans out to `read_card` and `tick`. After each exchange
`tick` returns its routes:

:::figure id="loop-routes" caption="After every exchange, tick picks its routes. A cast adds read to next, so a new card is read while the fight goes on."
:::

| Route | When | Goes to |
|---|---|---|
| `"next"` | The fight goes on | `tick` again |
| `"read"`, with `"next"` | A spell was just cast, so a new card is on the screen | `read_card`, alongside the fight |
| `"done"` | Someone is at 0 HP, or tick 45 | `summarize`, then `bard` |

The fight and the card reader never call each other. They share **state**: `read_card`
writes the spell into state, and each `tick` looks there and offers `cast`
once it has arrived.

:::figure id="card-alongside" caption="The fight and the card reader run on one event loop. While one waits for its model, the other runs, so reading a card never holds up a tick."
:::

:::key
Put the decisions in code and give each model a narrow job.
:::
:::
