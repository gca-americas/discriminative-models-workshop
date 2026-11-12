:::section kicker="Guidance" headline="Choose the right tool"
:::figure id="three-tools" caption="Code for explicit rules, a discriminative model for bounded answers, a language model for open-ended prose."
:::

| The answer is... | Use |
|---|---|
| Computable from explicit rules | **Code.** It is free, instant, and never wrong about its own rules. The arena's `resolve()` is code. |
| One of a known set of options, a level on a scale, or yes/no | **The Discriminative model.** A number in a few hundred milliseconds, calibrated, cheap enough to ask on every tick. With Gemini Decisions, the question can be about an image. |
| Open-ended prose or a conversation | **A language model.** Gemini, once, at the end of the fight. |

The arena in step 6 is all three. Code holds the rules, the thresholds and
the spell card's answer. A Discriminative model decides every tick and reads
the spell card. Gemini writes the tale.
:::

:::section kicker="Limitations" headline="Considerations"
- **Input depends on the model.** Jev and DiffusionGemma read text only, so
  images, audio and video need turning into text first. Gemini Decisions takes
  text, images, audio, video and PDFs. English is strongest; other languages
  work with lower accuracy.
- **It does not count, add, or follow chains.** Compute those in code and put
  the result in the state.
- **Option order can matter,** and a question with many options (50 or more)
  gets weaker. Descriptions help; hierarchies help more.
- **Injected instructions in the state can sway an answer.** Ask about the
  text, never let the text instruct.
- **A valid answer is not a correct one.** The Discriminative model cannot invent an option, but it
  can pick the wrong one. Calibrate against examples you have judged.
- **Limits:** Jev takes 64k tokens per request. Gemini Decisions takes 262k
  tokens and up to 1,000 questions. Both take 255 options per Choice and work
  best with 2 to 10 levels per Score. Rate limits depend on your plan.

:::figure id="model-limits" caption="What each hosted model accepts in one request."
:::
:::

:::section kicker="Summary" headline="Lab summary"
In this lab you:

- Chose a discriminative model, Jev, DiffusionGemma on a Compute Engine GPU
  VM, or Gemini Decisions, and checked that it answers.
- Played the arena by hand, against the clock, to learn its rules.
- Learned how a discriminative model answers with Choice, Score and Noul
  questions, probabilities and confidence, and how your code applies
  thresholds to them.
- Sent your first request, saw it through both SDKs, then let the model
  choose every move in the arena, with `choose()` turning its answers into
  actions.
- Read a spell card image with Gemini Decisions, and ran the fight loop on
  its own.
- Joined them in one ADK workflow that fights in a loop, reads each card on
  a branch beside it, casts on an opening, and has Gemini write the tale.
:::
