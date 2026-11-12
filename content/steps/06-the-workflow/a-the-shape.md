:::section kicker="Limitation" headline="Limits of per-tick decisions"
The last line of the fight in step 5 says it: *the ogre lumbers off, barely scratched*. The Discriminative model took no
damage and dealt a little on every tick, and 300 hit points is more than a
little times sixty. The spell card in the corner of the ring has been there
the whole time. Reading it takes a model that can see an image.

:::figure id="per-tick-limits" src="per-tick-limits.png"
:::
:::

:::section kicker="Limitation" headline="Why correct responses are not enough"
The ogre has 300 hit points. A right call counters for 3. A strike into an
opening does 8, because the hide is thick. Even a perfect sixty-tick fight
leaves the ogre bruised and standing, and the game calls it a draw. That is
where step 5 ended: the model defended well and still could not win.

Only a spell does real damage: 45 for a perfect casting, 67 when it lands on
an opening.
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
- **Gemini Decisions reads the spell card.** On its own branch, started at
  the bell, the workflow takes the card off the arena's screen as an image
  and asks four choice questions about it: the color, and the shape in each
  position. The arena judges the reading against the card's answer, which
  never leaves the server. After each cast a new card appears, and the branch
  reads that one too.
- **Code holds the rules.** `choose()` casts the spell the moment the model
  reports an opening. The words of the spell are a fixed line per element,
  because a decision model picks from options and does not write.
- **Gemini writes a short tale** once, at the end. That is the only
  open-ended text in the fight, so it is the only call to a language model.

:::figure id="arena-graph" caption="The fight loops on its own. The card is read beside it and the spell arrives through state. Gemini writes the tale when the fight ends."
:::
:::

:::section kicker="Architecture" headline="A loop, and a branch beside it"
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
| `"read"`, with `"next"` | A spell was just cast, so a new card is on the screen | `read_card`, on its own branch |
| `"done"` | Someone is at 0 HP, or tick 60 | `summarise`, then `bard` |

The two branches never call each other. They share **state**: `read_card`
writes the spell into state, and each `tick` looks there and offers `cast`
once it has arrived.

:::figure id="card-alongside" caption="Both branches run on one event loop. While one waits for its model, the other runs, so reading a card never holds up a tick."
:::

:::key
Put the decisions in code and give each model a narrow job.
:::
:::
