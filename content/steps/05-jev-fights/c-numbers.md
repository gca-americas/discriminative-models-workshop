:::section kicker="Latency" headline="Response time per decision"
Each tick of the fight in part b came back in a few hundred milliseconds or
less, inside the 70 to 500 millisecond range from step 4. Jev answers in about
a hundred. Gemini Decisions answers in about three hundred. DiffusionGemma on
a single GPU takes a little longer.
That is fast enough for a game loop, a request path, or a check on every
message before a person or a language model sees it.

:::figure id="latency-scale" caption="One decision next to the two-second timer you played against in step 3, and next to a language model writing an answer."
:::
:::

:::section kicker="Cost" headline="Input-based pricing"
A whole fight, forty-five decisions with three questions each, costs a fraction
of a cent. Jev is priced at $0.042 per million input tokens and Gemini
Decisions at $0.10, with a no-cost tier.
Output tokens are zero because nothing was generated.

:::figure id="cost-shape" caption="A language model's cost grows with the length of what it writes. The Discriminative model's only grows with what it reads."
:::

The consequence is that you can afford to ask more than you need. The arena
asks whether the ogre is exposed on every tick even though only `strike` and
`cast` care, because asking is nearly free and the answer is useful on the
dashboard. TypeSafe calls this *speculative fan-out*.
:::

:::section kicker="Decision logic" headline="Combine confidence and danger"
When the Discriminative model's confidence in its response is under 0.40 and
the danger score says a heavy hit is coming, `choose()` overrides it with a
dodge. A dodge is rarely the best answer, but it is rarely the worst.

:::note
Pick thresholds from the cost of each mistake, not from a round number, and
test them against telegraphs you have already judged by hand. TypeSafe's own
advice: if a decision keeps misfiring, tighten the question before you move
the threshold.
:::
:::
