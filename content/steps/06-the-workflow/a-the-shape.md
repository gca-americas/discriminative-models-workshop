:::section kicker="Limitation" headline="Limits of per-tick decisions"
The last line of the fight in step 5 says it: *the ogre lumbers off, barely scratched*. The Discriminative model took no
damage and dealt a little on every tick, and 300 hit points is more than a
little times sixty. The spell card in the corner of the ring has been there
the whole time. Reading it takes a model that can see an image.

:::figure id="per-tick-limits" src="per-tick-limits.png"
:::
:::

:::section kicker="Long-running work" headline="Handle work that takes longer than a tick"
Reading the spell card is a different kind of task. The Jev API does not
support images yet, so we need help from an LLM to process the image, and it
often takes longer to respond. But we don't want the player to stand still for
about ten ticks while the ogre attacks.

ADK offers two patterns for work that outlasts the step that starts it:

:::figure id="long-running" caption="Suspend and resume stops the workflow until the result arrives. A parallel branch lets the fast loop keep running and read the result from state when it is ready."
:::

| Pattern | How it works | Use it when |
|---|---|---|
| **Suspend and resume** | A `LongRunningFunctionTool` returns a pending receipt. The workflow stops at that node, and the open call ID is saved in the session. It resumes when a `FunctionResponse` with the same call ID arrives, from a webhook, a background worker or a person. `RequestInput` uses the same mechanism for human approval. | Nothing else can happen until the result is ready: a video render, a batch job, an approval step. |
| **Parallel branch with shared state** | The workflow fans out. The slow task runs on its own branch and writes its result to session state. The fast loop keeps running and reads that state on every iteration. | Other work must continue in the meantime: a real-time loop, a live session, a game. |

The arena needs the second pattern. The fight cannot pause while Gemini
works, so:

1. At the start of the match, the workflow fans out into the tick loop and the
   spell branch.
2. The spell branch downloads the spell card image, asks Gemini for the spell, and
   has the arena validate it. A valid spell is written to `state["spell"]`.
3. Every tick reads `state["spell"]`. Until it is set, the screen shows the
   spell as not ready. Once it is set, `cast` is added to the options.
4. When the model reports an opening, the code casts. The tick then routes
   back to the spell branch, which starts on the next spell card.

:::key
Suspend when the workflow has nothing else to do. Branch when it does.
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

:::key
Put the decisions in code and give each model a narrow job at its own pace.
:::
:::

:::section kicker="Observability" headline="Terminal and app views"
Run it with the arena in "Workflow fights" mode and both views are live. The
page shows the ring: the telegraph, the Discriminative model's bars, the spell card, and the spell's
status going from *reading* to *ready* to spent. The terminal shows the
timeline: ticks at a steady pace, and every few seconds a `gemini` line
cutting in between two of them, never holding one up.

Most of the wall clock is Gemini. The Discriminative model's share of a fifty-tick fight is six or
seven seconds of calls and about thirteen thousand input tokens.
:::
