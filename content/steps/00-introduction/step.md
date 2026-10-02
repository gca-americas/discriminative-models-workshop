:::section kicker="Context" headline="From conversation to decisions"
Generative AI reached most teams through chat and content generation. The
next stage is AI inside products and pipelines, where the model's output
drives an action directly: route a support ticket, flag a transaction, hold a
risky request for review, allow or block an agent's tool call, choose a move
in a game.

:::figure id="conversation-to-decisions" caption="In a conversation, a person reads the answer. In a decision, code acts on it, which changes what the model has to deliver."
:::

These decisions share three requirements that chat does not have:

- **Latency.** The answer is often in a user's request path or a real-time
  loop, so it has to arrive in milliseconds, not seconds.
- **Structure.** The caller is code, so the answer has to be a value it can
  act on, not a paragraph it has to parse.
- **Predictability.** Every decision needs a confidence the code can check,
  and a cost low enough to ask on every event.

A language model generates text one token at a time. It can be prompted into
a yes or no, but it is slow for a real-time loop, its output has to be parsed,
and it does not report how sure it is.
:::

:::section kicker="Discriminative models" headline="Models built for decisions"
A discriminative model answers a typed question with a probability for each
allowed option, in a single pass. It does not generate text. This workshop
provides two options to run:

| Model | Provider | Where the model runs in this workshop |
|---|---|---|
| **Jev** | TypeSafe AI | TypeSafe's hosted service, called with an API key |
| **DiffusionGemma** | Google, open weights | Self-hosted on a GPU VM in your own Google Cloud project |

The models can be swapped based on your needs; the code that connects to
them does not need to change.
:::

:::section kicker="System design" headline="Combine components"
A successful system consists of multiple components:

:::figure id="system-components" caption="A workflow orchestrates deterministic code, a discriminative model, and a language model. Each handles the work it is best suited for."
:::

| Component | Role | In this workshop |
|---|---|---|
| **Workflow** | Orchestrates steps, runs branches in parallel, holds shared state | An ADK graph workflow |
| **Deterministic code** | Rules, thresholds, validation. Instant, free, and auditable | The game rules, `choose()`, and spell validation |
| **Discriminative model** | Fast, bounded decisions with a confidence score | Choosing a response every tick |
| **Language model** | Perception and generation: images and open-ended text | Gemini reads the spell card image and writes the spell |
:::

:::section kicker="Approach" headline="A game as the example"
Have you ever played a combat game? You face an opponent and have to react
instantly to their moves. One wrong guess and your HP takes the hit. Games
also tend to make spells hard to cast. In ours, you have to pick the spell card's
color and shapes, in order, before the spell is released. This workshop
shows you how to combine both types of model to make your character win.

Each element of the game maps to a real system:

- **The opponent's move** is an incoming event, like a request or a
  transaction.
- **The response** is a bounded decision, made by the discriminative model
  and checked by code.
- **The spell card** is unstructured input that needs a language model to read.
- **The match** is the workflow, running fast and slow work at their own
  speeds.

The focus is on combining the four components and piecing them together to
build a fast and smart system.
:::

:::section kicker="Outcomes" headline="What you will learn"
- Explain how discriminative (System One) and generative (System Two) models
  differ, and when to use each.
- Write Choice, Score, and Noul questions, and interpret probabilities and
  confidence.
- Use thresholds in deterministic code to turn probabilities into actions.
- Call a discriminative model with the TypeSafe SDK, against Jev or against
  DiffusionGemma on Compute Engine.
- Describe how DiffusionGemma is served: vLLM in a container on a GPU VM,
  reached through Identity-Aware Proxy.
- Build an ADK graph workflow that runs a discriminative model and Gemini in
  parallel, at different speeds.
:::
