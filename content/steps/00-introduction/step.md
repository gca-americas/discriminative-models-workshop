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
provides three options to run:

:::figure id="three-models" caption="Three decision models and the two SDKs that reach them. The questions and the answers have the same shape on all three."
:::

| Model | Provider | Where the model runs in this workshop |
|---|---|---|
| **Jev** | TypeSafe AI | TypeSafe's hosted service, called with an API key |
| **DiffusionGemma** | Google, open weights | Self-hosted on a GPU VM in your own Google Cloud project |
| **Gemini Decisions** | Google | Google's hosted service on the Gemini Developer API, called with an API key |

The models can be swapped based on your needs. Jev and DiffusionGemma are
called with the TypeSafe SDK, and Gemini Decisions with the Google Gen AI SDK.
The workshop keeps both calls in one file, so the rest of the code does not
change when you switch.
:::

:::section kicker="System design" headline="Combine components"
A successful system consists of multiple components:

:::figure id="system-components" caption="A workflow orchestrates deterministic code, a discriminative model, and a language model. Each handles the work it is best suited for."
:::

| Component | Role | In this workshop |
|---|---|---|
| **Workflow** | Orchestrates steps, loops and branches, holds shared state | An ADK graph workflow |
| **Deterministic code** | Rules, thresholds, validation. Instant, free, and auditable | The game rules, `choose()`, and spell validation |
| **Discriminative model** | Fast, bounded decisions with a confidence score | Choosing a response every tick, and reading the spell card image |
| **Language model** | Open-ended text | Gemini writes the tale of the fight |
:::

:::section kicker="Approach" headline="A game as the example"
Have you ever played a combat game? You face an opponent and have to react
instantly to their moves. One wrong guess and your HP takes the hit. Games
also tend to make spells hard to cast. In ours, you have to pick the spell card's
color and shapes, in order, before the spell is released. This workshop
shows you how to combine both types of model to make your character win.

Each element of the game maps to a real system:

:::figure id="game-mapping" caption="Each part of the game stands for a part of a production system."
:::

- **The opponent's move** is an incoming event, like a request or a
  transaction.
- **The response** is a bounded decision, made by the discriminative model
  and checked by code.
- **The spell card** is an image. Its color and shapes come from a fixed set,
  so reading it is also a bounded decision, for a discriminative model that
  takes images.
- **The match** is the workflow, a loop that calls the right model at each
  step.
- **The tale of the fight** is open-ended text, written by a language model.

The focus is on combining the four components and piecing them together to
build a fast and smart system.
:::

:::section kicker="Outcomes" headline="What you will learn"
- Explain how discriminative (System One) and generative (System Two) models
  differ, and when to use each.
- Describe how Jev, DiffusionGemma and Gemini Decisions are served, and set
  one up for the workshop.
- Write Choice, Score, and Noul questions, and interpret probabilities and
  confidence.
- Use thresholds in deterministic code to turn probabilities into actions.
- Build a request, send it with the TypeSafe SDK or the Google Gen AI SDK,
  then let the model choose every move in a game.
- Read an image with Gemini Decisions by asking choice questions about it.
- Build an ADK graph workflow that fights in a loop, reads the spell card on
  a branch beside it, and hands the result to Gemini for a written summary.
:::
