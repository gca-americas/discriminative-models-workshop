:::section kicker="Access options" headline="Selecting the model"
You choose the model in step 2, depending on your preference and
environment. Jev and Gemini Decisions are hosted and need only an API key. If
you plan to use DiffusionGemma, make sure you have access to a GPU on Google
Cloud. Whichever you choose, step 6 also calls Gemini Decisions to read the
spell card, so everyone needs a Gemini API key.

| | Jev | DiffusionGemma | Gemini Decisions |
|---|---|---|---|
| **Provider** | TypeSafe AI, hosted API | Google, open weights | Google, hosted API |
| **Runs on** | TypeSafe's infrastructure | A Compute Engine VM in your project, with GPU | The Gemini Developer API |
| **Endpoint** | `https://api.typesafe.ai` | Through an IAP tunnel | `https://generativelanguage.googleapis.com` |
| **Authentication** | `TYPESAFE_API_KEY` | Your Google Cloud identity, checked by IAP | `GEMINI_API_KEY` |
| **SDK** | `typesafe-sdk` | `typesafe-sdk` | `google-genai` |
| **Input** | Text | Text | Text, images, audio, video, PDF |
| **Cost** | Per input token | Google Cloud's Compute Engine GPU pricing, while the VM runs | Per input token, with a no-cost tier |
| **Setup** | An API key | Install the model on a Compute Engine VM | An API key |

:::figure id="serving-dataflow" caption="The same questions take one of three paths. Jev and Gemini Decisions are called over HTTPS, each with its own SDK. DiffusionGemma is reached through an IAP tunnel to a VM in your project."
:::

### Data flow

1. The arena app or the ADK workflow builds a request: the state (what the
   opponent did) and three questions.
2. `scripts/decisions.py` hands the request to the SDK for the model you
   chose.
3. For **Jev**, the TypeSafe SDK sends `POST /v1/systemone` over HTTPS to
   `api.typesafe.ai`, with the API key as a bearer token.
4. For **DiffusionGemma**, the TypeSafe SDK sends the same request to
   `localhost:8096`. A background `gcloud compute start-iap-tunnel` process
   forwards it through Identity-Aware Proxy, which checks your Google
   identity, to port 8080 on the VM. There, djev-run runs DiffusionGemma
   through vLLM on the GPU and reads the probability of each allowed option.
5. For **Gemini Decisions**, the Google Gen AI SDK sends `POST
   /v1beta/decisions` over HTTPS to `generativelanguage.googleapis.com`, with
   the API key in the `x-goog-api-key` header. The model is
   `gemini-decision-1`.
6. All three return the same kind of response: an answer per question, with
   probabilities and a confidence score. The workshop code applies its
   thresholds and acts.
:::

:::section kicker="SDKs" headline="Two SDKs for the same request"
The two SDKs ask the same thing in slightly different words. Both take a set
of named questions, each a Choice, a Score or a Noul, and both return one
typed answer per question.

:::figure id="two-sdks" caption="The same request through each SDK. The questions and the answers match. The state is called state in one and input in the other."
:::

| | TypeSafe SDK | Google Gen AI SDK |
|---|---|---|
| **Package** | `typesafe-sdk` | `google-genai` |
| **Client** | `TypeSafeClient()` | `genai.Client()` |
| **Call** | `client.system_one(...)` | `client.decisions.create(...)` |
| **What to judge** | `state`, an object or text | `input`, text or content blocks such as an image |
| **Model** | set on the client, `jev-latest` by default | `model="gemini-decision-1"` |
| **Questions** | `Choice`, `Score` and `Noul` objects | the same three types, as plain dicts |
| **Answers** | `.choice`, `.score`, `.noul`, `.confidence`, `.probabilities` | the same fields |
:::

:::section kicker="Deployment" headline="DiffusionGemma on Compute Engine"
:::figure id="serving-stack" caption="The software stack on the VM. The model runs in vLLM inside a container, with the GPU passed through to it."
:::

`scripts/setup_gemma.sh` builds this in your project:

1. Checks that the region has quota for a GPU.
2. Enables the Compute Engine and IAP APIs, and creates the firewall rule
   `allow-iap-djev`. It admits only the IAP address
   range, on ports 22 and 8080.
3. Creates the VM `djev-l4`: machine type `g2-standard-4` (4 vCPUs, 16 GB of
   memory), a GPU with 24 GB, a 100 GB disk, and the Deep Learning VM
   image with NVIDIA driver 580. If a zone has no GPU capacity, it tries the
   next one.
4. On first boot, the VM's startup script installs Docker and the NVIDIA
   Container Toolkit, pulls the djev-run container image, downloads the
   weights from Hugging Face (17.5 GB), and starts the container with GPU
   access on port 8080. This takes about 15 minutes. Later boots take about 2.
5. Writes the connection settings to `.env` and opens the tunnel.

:::file path="scripts/setup_gemma.sh" label="Show the script"
:::

| Task | Command |
|---|---|
| Stop the VM (keeps the disk) | `scripts/gemma_warm.sh off` |
| Start it again | `scripts/gemma_warm.sh on` |
| Check the tunnel | `scripts/gemma_tunnel.sh status` |
| Delete everything | `scripts/teardown_gemma.sh` |
:::
