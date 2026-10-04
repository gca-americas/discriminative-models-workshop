#!/bin/bash
# Runs on the DiffusionGemma VM at every boot (as its GCE startup script).
# Idempotent: the first boot installs and downloads (~15 min); later boots only
# start the model (~2 min).
#
#   1. Docker and the NVIDIA container toolkit (the Deep Learning VM image has
#      the GPU driver but neither of these)
#   2. the weights, straight from Hugging Face, onto the VM's own disk
#   3. djev-run (github.com/taeold/djev-run): DiffusionGemma behind the Discriminative model's API,
#      on port 8080, reachable only through the IAP tunnel (see the firewall
#      rule setup_gemma.sh makes)
#
# Progress: sudo tail -f /var/log/djev-startup.log  (on the VM)
set -x
exec >> /var/log/djev-startup.log 2>&1
echo "=== boot $(date -u)"

WEIGHTS_REPO="nvidia/diffusiongemma-26B-A4B-it-NVFP4"
WEIGHTS=/opt/dgemma
# Pinned: djev-run publishes only `latest` and changes it several times a day
# (the 2026-09-23 20:43 build fails to start). This is the 19:15 build of
# 2026-09-23 ("Fallback to standard base64 when pybase64 is missing"), the one
# this workshop was tested on. Change it deliberately, and test.
IMAGE=ghcr.io/taeold/djev-run@sha256:efbf11a54e10c42b7d1379194befe100535171bfe9ed70dc1e431302d2b7a14b

# ── 1. docker + GPU access for containers ───────────────────────────────────
if ! command -v docker >/dev/null; then
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io
fi
if ! command -v nvidia-ctk >/dev/null; then
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
    | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
    | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
    > /etc/apt/sources.list.d/nvidia-container-toolkit.list
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nvidia-container-toolkit
  nvidia-ctk runtime configure --runtime=docker && systemctl restart docker
fi
# The image's NVIDIA driver is a kernel module built for one kernel. Ubuntu's
# automatic security updates can install a newer kernel, and on the next boot
# the GPU has no driver ("nvml error: driver not loaded"). Install the module
# for the running kernel when it is missing, then load it.
if ! nvidia-smi >/dev/null 2>&1; then
  echo "no NVIDIA driver for kernel $(uname -r); installing its module"
  FLAVOUR="$(dpkg -l 'linux-modules-nvidia-*' 2>/dev/null | awk '/^ii/ {print $2}' \
    | sed -E 's/^linux-modules-(nvidia-[0-9]+(-server)?(-open)?)-.*/\1/' | head -1)"
  apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "linux-modules-${FLAVOUR:-nvidia-580-server-open}-$(uname -r)"
  modprobe nvidia
fi
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader

# ── 2. weights from Hugging Face (public; no token needed) ──────────────────
# Downloaded with the model image itself, which already has Python and
# huggingface_hub (the VM image has no python3-venv to make our own).
docker pull -q "$IMAGE"
if [ ! -f "$WEIGHTS/.complete" ]; then
  mkdir -p "$WEIGHTS"
  docker run --rm -v "$WEIGHTS":/w --entrypoint python3 "$IMAGE" -c \
    "from huggingface_hub import snapshot_download; snapshot_download('$WEIGHTS_REPO', local_dir='/w')" \
    && touch "$WEIGHTS/.complete"
fi
if [ ! -f "$WEIGHTS/.complete" ]; then
  echo "WEIGHTS DOWNLOAD FAILED: not starting the model. See the lines above."
  exit 1
fi

# ── 3. the model ────────────────────────────────────────────────────────────
# Four adjustments to the image, which is built for Cloud Run:
#  · (later builds) its entrypoint wraps `import pybase64 as base64` in
#    try/except even when the server file already has that wrapper, which
#    breaks it with an IndentationError. UNWRAP below renames the import in
#    exactly that case, so the entrypoint's check no longer matches.
#  · it puts a CUDA "compat" libcuda ahead of the driver; on a driver newer than
#    that copy CUDA refuses to start (error 803), so it is hidden;
#  · it reads weights from /mnt/gcs/dgemma, so they are mounted there;
#  · it loads from /dev/shm/dgemma, copying the weights there in the
#    background while the engine starts. On Cloud Run /dev/shm is RAM and the
#    copy wins the race; on disk it loses. So /dev/shm is a plain directory on
#    the VM's disk, filled before the container starts with hard links (no
#    extra space, no RAM: this is what lets the VM have 16 GB) and marked
#    .ready so the image skips its copy.
mkdir -p /opt/empty-compat /opt/devshm
rm -rf /opt/devshm/dgemma
cp -al "$WEIGHTS" /opt/devshm/dgemma
touch /opt/devshm/dgemma/.ready
# Only touches the server file when it already has its own try/except around
# the import, which is the case the entrypoint would wrap a second time.
UNWRAP="python3 -c \"import os; p='/opt/dgemma/structured_server.py'
if os.path.exists(p):
    s = open(p).read()
    if 'try:\\n    import pybase64 as base64' in s:
        open(p, 'w').write(s.replace('import pybase64 as base64', 'import pybase64 as _pb64; base64 = _pb64'))\""
docker rm -f djev 2>/dev/null || true
docker run -d --name djev --restart unless-stopped --gpus all \
  -p 8080:8080 \
  -v "$WEIGHTS":/mnt/gcs/dgemma:ro \
  -v /opt/empty-compat:/usr/local/cuda-13.0/compat:ro \
  -v /opt/devshm:/dev/shm \
  -e MODEL=/mnt/gcs/dgemma -e MAX_MODEL_LEN=4096 -e KV_CACHE_GB=2 -e ATTN=TRITON_ATTN \
  -e TEST_PAGE=1 -e ENFORCE_EAGER=1 -e DISABLE_MM=1 -e TORCH_COMPILE_DISABLE=1 \
  -e VLLM_WORKER_MULTIPROC_METHOD=fork -e VLLM_UF_EAGER_ALL=1 -e CUDA_MODULE_LOADING=LAZY \
  -e CANVAS=128 -e MAX_SEQS=8 -e GPU_UTIL=0.92 -e COPY_TO_SHM=0 \
  --entrypoint bash "$IMAGE" -c "$UNWRAP; exec /entrypoint.sh"
echo "djev container started"
