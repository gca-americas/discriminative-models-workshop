:::section kicker="Latency" headline="Response time per decision"
Each tick of the fight in part b came back in about a hundred milliseconds, a
few in two or three.
That is fast enough for a game loop, a request path, or a check on every
message before a person or a language model sees it.
:::

:::section kicker="Cost" headline="Input-based pricing"
The totals line ends with input tokens and dollars. A whole fight, sixty
decisions with three questions each, costs well under a tenth of a cent.
Output tokens are zero because nothing was generated.

:::figure id="cost-shape" caption="A language model's cost grows with the length of what it writes. The Discriminative model's only grows with what it reads."
:::

The consequence is that you can afford to ask more than you need. The arena
asks whether the ogre is exposed on every tick even though only `strike` and
`cast` care, because asking is nearly free and the answer is useful on the
dashboard. TypeSafe calls this *speculative fan-out*.
:::

:::section kicker="Decision logic" headline="Combine confidence and danger"
Look for a `*` in the "jev says" column. That tick, the Discriminative model's confidence in its
response was under 0.40 while the danger score said a heavy hit was coming,
and `choose()` overrode it with a dodge. A dodge is rarely the best answer,
but it is rarely the worst.

:::note
Pick thresholds from the cost of each mistake, not from a round number, and
test them against telegraphs you have already judged by hand. TypeSafe's own
advice: if a decision keeps misfiring, tighten the question before you move
the threshold.
:::
:::
