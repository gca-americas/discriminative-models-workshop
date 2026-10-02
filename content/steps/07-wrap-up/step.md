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

:::section kicker="Cost" headline="Pricing"
Input is $0.042 per million tokens and output is free. Latency is 70 to 500
milliseconds end to end. TypeSafe's own workflow evaluations claim up to
190× faster and 400× cheaper than frontier language models on decision tasks;
treat those as the vendor's numbers, and measure your own. Independent tests
so far find the Discriminative model competitive on reranking and simple classification, and weaker
than tuned in-house models on large label sets.
:::

:::section kicker="Resources" headline="Next steps"
- **The docs:** [docs.typesafe.ai](https://docs.typesafe.ai). The *patterns*
  and *cookbooks* sections cover confidence-gated routing, speculative
  fan-out, guardrails for LLMs, re-ranking and function calling.
- **On open weights:** DiffusionGemma, Google's open diffusion model, can
  answer Discriminative-model-style questions in one parallel pass. djev-run serves it behind
  the Discriminative model's exact API, and `scripts/setup_gemma.sh` puts it on a GPU in your own
  project, so the decisions never leave it.
- **In other stacks:** Pydantic AI has `typesafe:jev-latest` as a model that
  fills a Pydantic class one field per question. OpenRouter, Cloudflare and
  Vercel gateways carry it too.
- **In ADK:** the same idea works without a graph when all you want is a gate.
  `before_model_callback` and `before_tool_callback` on a single agent can call
  the Discriminative model and refuse, the way `choose()` refuses a shaky strike.
- **For your coding agent:** `claude plugin marketplace add typesafe-ai/skills`
  installs a skill that teaches Claude Code how to write these questions.
  Expect to edit the questions it writes.
:::
