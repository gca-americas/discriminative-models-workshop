:::section kicker="Guidance" headline="Choose the right tool"
:::figure id="three-tools" caption="Code for explicit rules, a discriminative model for bounded answers, a language model for open-ended prose."
:::

| The answer is... | Use |
|---|---|
| Computable from explicit rules | **Code.** It is free, instant, and never wrong about its own rules. The arena's `resolve()` is code. |
| One of a known set of options, a level on a scale, or yes/no | **The Discriminative model.** A number in a few hundred milliseconds, calibrated, cheap enough to ask on every tick. |
| Open-ended prose, an image to read, or a conversation | **A language model.** Gemini, on its own branch, with the Discriminative model deciding when to use what it made. |

The arena in step 6 is all three. Code holds the rules, the thresholds and
the spell card's answer. The Discriminative model decides every tick. Gemini reads, sings and narrates.
:::

:::section kicker="Limitations" headline="Considerations"
- **The Discriminative model reads text only.** Images, audio and video need turning into text
  first. English is strongest; other languages work with lower accuracy.
- **It does not count, add, or follow chains.** Compute those in code and put
  the result in the state.
- **Option order can matter,** and a question with many options (50 or more)
  gets weaker. Descriptions help; hierarchies help more.
- **Injected instructions in the state can sway an answer.** Ask about the
  text, never let the text instruct.
- **A valid answer is not a correct one.** The Discriminative model cannot invent an option, but it
  can pick the wrong one. Calibrate against examples you have judged.
- **Limits:** 64k tokens per request, 255 options per Choice, 2 to 10 levels
  per Score, rate limits that adjust with demand.
:::

:::section kicker="Summary" headline="Lab summary"
In this lab you:

- Chose a discriminative model, Jev or DiffusionGemma on a Compute Engine GPU
  VM, and checked that it answers.
- Played the arena by hand, against the clock, to learn its rules.
- Learned how a discriminative model answers with Choice, Score and Noul
  questions, probabilities and confidence, and how your code applies
  thresholds to them.
- Sent your first request, then let the model choose every move in the arena,
  with `choose()` turning its answers into actions.
- Built each branch of an ADK workflow on its own, with Gemini reading a spell
  card image and the model deciding in a loop.
- Joined them in one workflow that shares state, so the fight never waits for
  Gemini and the spell is cast on an opening.
:::
