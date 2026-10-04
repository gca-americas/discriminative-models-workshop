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
The spell card in the corner of the ring is the way to win, and reading it is not
a text problem: it is a picture,
with a color and three shapes in a row, and the spell has to
be sung to match. That takes a model that can look at an image and take a
few seconds over it. In a fight, a few seconds is ten ticks.

So the workflow uses both, each at its own speed:

- **The Discriminative model fights.** Every tick, one call, one decision, a hundred milliseconds.
  The loop never waits for anything slower than itself.
- **Gemini reads and sings.** On its own branch, started at the bell, it
  grabs the spell card off the arena's screen as an image, names the color and
  the shapes, and sings an incantation. The arena judges the song against
  the spell card's answer, which never leaves the server.
- **After every exchange, the fighter checks the slot.** A `check_spell`
  node looks at state. Not ready: it says so, with how long Gemini has been
  singing, and routes straight back to the next tick. It never waits. Ready:
  `cast` joins the options the Discriminative model is offered, and `choose()` spends the spell
  the moment the Discriminative model reports an opening. When the spell is spent, the screen
  draws a new spell card and the slow thread starts again. A misread song burns
  the spell card, and the slow thread reads the new one.
- **Gemini writes a short tale** once, at the end.

:::figure id="arena-graph" caption="Two speeds in one graph. The fast loop never blocks on the slow branch; it just checks state each tick."
:::
:::

:::section kicker="Architecture" headline="Parallel branches with different latencies"
This is an ADK **Workflow**: a graph of nodes joined by edges. A node is a
plain Python function or an LLM agent. An edge from one node to a *tuple* of
nodes is a fan-out: both start, concurrently. A node that returns an `Event`
with a `route` picks which edge is taken next, and a node that routes to
itself is a loop.

Think of it as two threads. Thread 1 is slow: read the spell card, sing, store the
spell. Thread 2 is fast: tick, check the slot, tick again. Thread 1 ends in
a function that writes the judged spell into session **state** and returns
no output. Thread 2's `check_spell` reads that state after every exchange.
Neither thread calls or waits for the other; they only share state.

:::figure id="parallel-branch"
:::

:::key
Put the decisions in code and give each model a narrow job at its own pace.
:::
:::
