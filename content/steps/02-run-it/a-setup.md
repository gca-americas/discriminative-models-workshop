:::section kicker="Prerequisites" headline="The SDKs"
Two client libraries reach the three models: `typesafe-sdk` for Jev and
DiffusionGemma, and `google-genai` for Gemini Decisions. This workshop already
has both. They are installed in the workbench's own environment, alongside
`google-adk` for step 6.

```bash
pip install typesafe-sdk        # Jev, DiffusionGemma
pip install google-genai        # Gemini Decisions
```

:::figure id="two-sdks" caption="The same request through each SDK. The workshop keeps both calls in scripts/decisions.py and uses the one that matches your model."
:::
:::

:::section kicker="Prerequisites" headline="API keys"
Jev and Gemini Decisions are hosted APIs, so there is nothing to download.
Each needs a key, and each SDK reads its key from an environment variable.
This workshop's scripts also read a `.env` file at the root, so one line per
key is enough.

:::figure id="model-keys" caption="The key each model needs. Every choice also needs the Gemini API key, because step 6 reads the spell card with Gemini Decisions and writes the tale with Gemini."
:::

| Key | Where to get it | Used for |
|---|---|---|
| `TYPESAFE_API_KEY` | [TypeSafe console](https://console.typesafe.ai/login?returnTo=%2Fkeys) | Jev, if you choose it |
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/apikey) | Gemini Decisions, and step 6 for every choice |

```
TYPESAFE_API_KEY=apikey_...
GEMINI_API_KEY=...
```

The exercise below takes the keys, checks each with one request, and writes
them to `.env` for you.
:::

:::section kicker="Alternative" headline="Use DiffusionGemma"
**djev-run** reimplements Jev's API. It serves the
same `POST /v1/systemone` endpoint, with the same noul, choice and score
questions, from **DiffusionGemma**, Google DeepMind's open diffusion model
(26B total parameters, about 4B active, Apache 2.0). Because the wire format is
the same, the TypeSafe SDK talks to it unchanged.

If you choose DiffusionGemma in the exercise below, it runs on a
GPU in a VM in your own Google Cloud project, and the pill at the top right
reads *gemma on vm*. The workbench reaches it through a private IAP tunnel, and
the model's port is not open to the internet. Step 1 describes the full
architecture.

:::figure id="serving-stack" caption="The software stack on the VM. The TypeSafe SDK calls djev-run, which serves Jev's API on top of DiffusionGemma."
:::

:::note
Why a diffusion model can do this: it fills a whole block of positions at
once, with every position seeing the full input, so the probability of each
allowed option can be read in a single step. A normal language model
produces one token at a time and would have to be sampled repeatedly.
:::
:::
:::section kicker="Alternative" headline="Use Gemini Decisions"
**Gemini Decisions** is Google's hosted decision model, `gemini-decision-1`, on
the Gemini Developer API. There is nothing to deploy. The Google Gen AI SDK
sends the request to `POST /v1beta/decisions` with your Gemini API key, and
the answers come back in the same shape as Jev's.

If you choose Gemini Decisions in the exercise below, the pill at the top
right reads *gemini decisions*. It also reads images, which is why step 6 uses
it to read the spell card for every choice.

:::figure id="serving-dataflow" caption="The three paths a request can take. Gemini Decisions is the bottom one: the Google Gen AI SDK, over HTTPS, with an API key."
:::
:::
