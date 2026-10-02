:::section kicker="Access options" headline="Selecting the model"
You choose the model in step 2, depending on your preference and
environment. If you plan to use DiffusionGemma, make sure you have access to a
GPU on Google Cloud.

| | Jev | DiffusionGemma |
|---|---|---|
| **Provider** | TypeSafe AI, hosted API | Google, open weights |
| **Runs on** | TypeSafe's infrastructure | A Compute Engine VM in your project, with GPU |
| **Endpoint** | `https://api.typesafe.ai` | Through an IAP tunnel |
| **Authentication** | `TYPESAFE_API_KEY` | Your Google Cloud identity, checked by IAP |
| **Cost** | Per input token | Google Cloud's Compute Engine GPU pricing, while the VM runs |
| **Setup** | An API key | Install the model on a VM or Cloud Run |

:::figure id="serving-dataflow" caption="The same request takes one of two paths. Jev is called over HTTPS. DiffusionGemma is reached through an IAP tunnel to a VM in your project."
:::

### Data flow

1. The arena app or the ADK workflow builds a request: the state (what the
   opponent did) and three questions.
2. The TypeSafe SDK sends it as `POST /v1/systemone` to the configured base
   URL.
3. For **Jev**, the request goes over HTTPS to `api.typesafe.ai`, with the API
   key as a bearer token.
4. For **DiffusionGemma**, the request goes to `localhost:8096`. A background
   `gcloud compute start-iap-tunnel` process forwards it through
   Identity-Aware Proxy, which checks your Google identity, to port 8080 on
   the VM.
5. On the VM, djev-run receives the request, runs DiffusionGemma through vLLM
   on the GPU, and reads the probability of each allowed option.
6. Both backends return the same response: an answer per question, with
   probabilities and a confidence score. The workshop code applies its
   thresholds and acts.
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
