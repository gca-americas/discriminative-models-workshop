:::section kicker="Prerequisites" headline="TypeSafe SDK"
The client library is `typesafe-sdk` for Python. This workshop already has it:
it is installed in the workbench's own environment, alongside `google-adk` for
step 6.

```bash
pip install typesafe-sdk        # or: uv add typesafe-sdk
```
:::

:::section kicker="Prerequisites" headline="Jev endpoint"
The Jev model is a hosted API, so there is nothing else to download. To get a
key, sign up at the
[TypeSafe console](https://console.typesafe.ai/login?returnTo=%2Fkeys).
The SDK looks for the key in the
`TYPESAFE_API_KEY` environment variable, and this workshop's scripts also read
a `.env` file at the root, so one line there is enough:

```
TYPESAFE_API_KEY=ts-...
```
:::

:::section kicker="Alternative" headline="Use DiffusionGemma"
**djev-run** reimplements the Discriminative model's API. It serves the
same `POST /v1/systemone` endpoint, with the same noul, choice and score
questions, from **DiffusionGemma**, Google DeepMind's open diffusion model
(26B total parameters, about 4B active, Apache 2.0). Because the wire format is
the same, the TypeSafe SDK talks to it unchanged.

If you choose DiffusionGemma in the exercise below, it runs on a
GPU in a VM in your own Google Cloud project, and the pill at the top right
reads *gemma on vm*. The workbench reaches it through a private IAP tunnel, and
the model's port is not open to the internet. Step 1 describes the full
architecture.

:::note
Why a diffusion model can do this: it fills a whole block of positions at
once, with every position seeing the full input, so the probability of each
allowed option can be read in a single step. A normal language model
produces one token at a time and would have to be sampled repeatedly.
:::
:::
