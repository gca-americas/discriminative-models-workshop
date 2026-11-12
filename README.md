# Getting started with Discriminative models (Jev/Gemini Decisions)

A one-hour workshop on discriminative (System One) decision models, and on
putting one next to Gemini in a Google ADK workflow. It takes about sixty
minutes and is built around a fighting game. The student fights the ogre by
hand first, then hands the reflexes to a decision model, then watches an ADK
workflow win the fight with the decision model deciding every tick, Gemini
Decisions reading spell cards off the screen, and Gemini writing the tale.

It runs the same way the Cloud 101 workbench does: concepts first on each
page, the exercise last, and every check asks the machine rather than the
student.

## Overview

A discriminative model does not generate text. You send it **state** (text,
JSON, or a list) and typed **questions** (`Choice`, `Score`, `Noul`), and it
returns typed answers with calibrated probabilities. Its job is the decision
in front of, between, and behind the language models: routing, classification,
gating, and here, a fighter's reflexes.

Step 2 offers these decision models:

- **Jev** (`jev-1.13`, alias `jev-latest`) is a hosted model from TypeSafe AI,
  released September 19, 2026. It answers in roughly 70 to 500 ms, for $0.042
  per million input tokens.
- **DiffusionGemma** is Google's open-weights model. The workshop runs it on a
  GPU VM in your own project, behind Jev's API.
- **Gemini Decisions** (`gemini-decision-1`) is Google's hosted model on the
  Gemini Developer API. It costs $0.10 per million input tokens and has a
  no-cost tier. It also takes images, which step 6 uses to read spell cards.

Output tokens are free on both hosted models.

## Setup

In Cloud Shell, or anywhere `gcloud` is signed in:

```bash
./setup_project.sh     # a new project with billing, recorded in ~/project_id.txt
./setup_codelab.sh     # everything else, then the workbench on port 4900
```

`setup_project.sh` creates a project (`discrim-models-XXXX`), links billing to
it, preferring an event credit account when you have one, and waits until the
project can serve. Re-running it reuses the project in `~/project_id.txt`. To
use a project you already have, put its ID in that file and skip this script.

`setup_codelab.sh` reads the project from `~/project_id.txt`. When that file
is missing it asks for the ID of an existing project and records it. It then
installs uv and the Python packages, enables Compute Engine and IAP (both for
DiffusionGemma), records the project in `.env` as `GOOGLE_CLOUD_PROJECT`,
puts the exercise files in place, builds the page, starts the workbench in the
background and runs `scripts/check_setup.py`. Re-running it keeps your
exercise files; `scripts/starter.sh` resets them. The decision model and the
Gemini API key are set in step 2 of the workbench.

On a laptop, sign in once with `gcloud auth login`, then run the same two
scripts. `scripts/stop.sh` stops the workbench, and `scripts/start.sh` runs it
again in the foreground, after a break for example.

Everything Gemini uses one `GEMINI_API_KEY`, created at
https://aistudio.google.com/apikey. Gemini Decisions uses it as a decision
model, and step 6 uses it to read the spell card (`gemini-decision-1`) and to
write the tale. Every model choice needs this key because of step 6.

The tale is written by `gemini-flash-latest` unless `JEV101_GEMINI_MODEL` says
otherwise. When `.env` already holds a working Gemini API key,
`setup_codelab.sh` runs `scripts/pick_gemini_model.py`, which tries
`gemini-flash-latest`, falls back to the newest Flash model the key can call,
and saves the result as `JEV101_GEMINI_MODEL`.

The decision model is chosen in step 2 of the workbench, or from a terminal
with `scripts/setup_model.sh`:

| Choice | Needs | Setup | Cost |
|---|---|---|---|
| **Jev** (TypeSafe, hosted) | a TypeSafe API key (`TYPESAFE_API_KEY`) | none | $0.042 per 1M input tokens |
| **DiffusionGemma** (Google, open weights) | billing + Compute Engine quota for **1 × NVIDIA L4** | ~15 min, automatic | ~$0.71/h while the VM runs |
| **Gemini Decisions** (Google, hosted) | a Gemini API key (`GEMINI_API_KEY`) | none | $0.10 per 1M input tokens, with a no-cost tier |

`scripts/setup_model.sh --model jev|gemma|gemini --yes` answers for you. The
script records the choice in `.env` as `JEV101_MODEL`.

Each choice is checked before it is kept:

- **Jev.** The key is tried with one real request (`scripts/verify_jev_key.py`).
  A refused key is not saved.
- **DiffusionGemma.** The GPU quota is checked before anything is created. A
  VM from an earlier setup is started again instead of being rebuilt.
- **Gemini Decisions.** The key is tried with one real request to
  `gemini-decision-1` (`scripts/verify_gemini_key.py`). A refused key is not
  saved.
- **The Gemini API key.** It is checked the same way for Jev and
  DiffusionGemma, because step 6 needs it.
- **If one fails,** setup says why and offers the options not yet tried. With
  nobody there to answer, it tries Gemini Decisions next. Step 2 runs the
  script with `--no-fallback` and offers the other options itself. Keys are
  passed in the script's environment, never on its command line.

Switching away from DiffusionGemma stops its VM. Any switch stops a running
arena app, which reads the model settings when it starts.

### DiffusionGemma on a Compute Engine VM

`scripts/setup_gemma.sh` (run by `setup_model.sh` when you pick it) checks the L4
quota first, then makes one `g2-standard-4` VM (1 × L4 24 GB, 4 vCPU, 16 GB)
from Google's Deep Learning image with NVIDIA driver 580. On first boot the VM
installs Docker, downloads the weights from Hugging Face
(`nvidia/diffusiongemma-26B-A4B-it-NVFP4`, 17.5 GB, public, no token) and runs
[djev-run](https://github.com/taeold/djev-run): DiffusionGemma behind the Discriminative model's
exact API. The model's port is not open to the internet: the workbench
reaches it through an IAP tunnel on `localhost:8096`, which `scripts/start.sh`
opens.

| | |
|---|---|
| Pause / resume | `scripts/gemma_warm.sh off` / `on` (stopped: disk only, ~$10/month) |
| Tunnel | `scripts/gemma_tunnel.sh start` / `stop` / `status` |
| Remove | `scripts/teardown_gemma.sh` |
| Preview the commands | `scripts/setup_gemma.sh --dry-run` |

#### Connect to the VM through IAP

The model listens on port 8080, and no firewall rule opens 8080 to the
internet. The rule setup makes, `allow-iap-djev`, admits only Google's IAP
range (`35.235.240.0/20`) on ports 22 and 8080. So every machine that runs
the workbench reaches the model through an IAP TCP tunnel:

```
localhost:8096  ──gcloud compute start-iap-tunnel──►  djev-l4:8080 (djev-run)
```

- `.env` says where to go: `TYPESAFE_BASE_URL=http://127.0.0.1:8096`, plus
  `JEV101_GEMMA_VM`, `JEV101_GEMMA_ZONE` and `JEV101_GEMMA_PROJECT`, all
  written by `setup_gemma.sh`.
- `scripts/start.sh` opens the tunnel whenever `JEV101_GEMMA_VM` is set, and
  so do `setup_gemma.sh` and `gemma_warm.sh on`. `gemma_warm.sh off` closes it.
- The tunnel is a background `gcloud` process. Its pid is in
  `runs/gemma-tunnel.pid` and its log in `runs/gemma-tunnel.log`.
- It needs `gcloud` signed in as someone with *IAP-secured Tunnel User*
  (`roles/iap.tunnelResourceAccessor`) on the project. Owner includes it;
  anyone else needs it granted.
- The VM keeps an external IP, for its own downloads (Docker, the image, the
  weights). That does not expose the model. A project's default network often
  also has `default-allow-ssh`, which opens port 22 to everyone; that rule
  is the project's, not this workshop's.

**Cloud Shell needs the tunnel too.** Cloud Shell runs outside your
project's network, so it cannot reach the VM directly. `gcloud` there is
already signed in, so the same scripts work unchanged. Open the workbench
with Web Preview on port 4900. Cloud Shell ends idle sessions and the tunnel
goes with them: after a break, run `scripts/start.sh` again.

**When the model stops answering** (the arena says it could not reach the
model, or `check_setup.py` is not ready):

```
scripts/gemma_tunnel.sh status    # tunnel open? model answering?
scripts/gemma_tunnel.sh start     # reopen it
scripts/gemma_warm.sh on          # if the VM itself was stopped
cat runs/gemma-tunnel.log         # gcloud's own error, e.g. auth or IAP permission
```

Do not open port 8080 to the internet instead: the model has no
authentication of its own.

Why a VM and not Cloud Run: djev-run's image needs CUDA 13. Cloud Run's L4
hosts run an older NVIDIA driver, and the image fails there with CUDA error
803; its README recipe uses Cloud Run's RTX PRO 6000 instead, a GPU most
projects have no quota for. On a VM we choose the driver. Three adjustments
to the image make it run on the L4 (see `scripts/gemma_vm_startup.sh`): its
bundled CUDA compat library is hidden, the weights are mounted where it
expects them, and they are not copied into RAM, which is what lets the VM
have 16 GB. On the L4 the 4-bit weights run through vLLM's Marlin kernel
(the L4 has no native FP4): about 450 ms per three-question call, which is
fine for the arena's half-second ticks.

`scripts/setup_gemma_cloudrun.sh` keeps the Cloud Run route for projects that
do have RTX PRO 6000 quota.

## Run the workshop

```bash
scripts/start.sh            # http://localhost:4900
scripts/dev.sh              # API on 4900, Vite with hot reload on 5274
```

You need `uv`, `node`, `gcloud`, and these settings in a `.env` at the root.
`setup_codelab.sh` writes the project line, and step 2 writes the rest:

```
GEMINI_API_KEY=...                     # Gemini Decisions, and step 6, whichever model you pick
JEV101_MODEL=jev                       # jev, gemma or gemini
TYPESAFE_API_KEY=apikey_...            # Jev only
TYPESAFE_BASE_URL=http://127.0.0.1:8096    # DiffusionGemma only, written by setup_gemma.sh
GOOGLE_CLOUD_PROJECT=your-project      # DiffusionGemma's project
```

`python3 scripts/check_setup.py` says what is set up. The lights at the top
right of every page say the same thing.

The Python packages are `typesafe-sdk` 0.7, `google-genai` 3.2 and
`google-adk` 2.14. ADK 2.14 pins `google-genai<3` and the Decisions API needs
3.2, so `pyproject.toml` carries a uv override for `google-genai`.

## Agenda

| Step | Minutes | Description |
|---|---|---|
| 0 Introduction | 4 | Why fast, structured decisions matter; how discriminative models fit into a production system; what the workshop covers. |
| 1 Model serving architecture | 6 | Jev and Gemini Decisions over HTTPS, each with its own SDK, and DiffusionGemma through IAP: the request path, and the software stack on the Compute Engine GPU VM. |
| 2 Set up the model | 8 | Choose Jev, DiffusionGemma or Gemini Decisions in the workbench and enter the Gemini API key; each is checked before it is kept. |
| 3 Play the game manually | 6 | Start the arena app, review the rules, and respond to each move within two seconds. |
| 4 Discriminative model concepts | 9 | System One and System Two models; Choice, Score, and Noul; probability, confidence, and thresholds. Two interactive widgets. |
| 5 Automate decisions with the model | 9 | Run the arena with the model choosing each response. Fill in a request (a telegraph and a choice question) and run it. Review the probabilities, the confidence rule in `choose()`, latency and cost. The model avoids damage but cannot win. |
| 6 Combine models in an ADK workflow | 12 | `agents/arena/agent.py`: an ADK graph with a fight loop and a card-reading branch beside it. The decision model answers each tick, Gemini Decisions reads the spell card image while the fight goes on and the arena judges the reading, and Gemini writes the tale at the end. |
| 7 Summary and next steps | 3 | When to use code, a discriminative model, or a language model; limitations; a summary of the lab. |

## Architecture

Three processes on the student's machine (or Cloud Shell), and the outside
services they call: the decision model, Gemini Decisions and Gemini. ② calls
the decision model in "Discriminative model fights"; ③ calls all of them in
"Workflow fights".

```
 browser ── http://localhost:4900
   │  the workbench page (React, web/dist)
   │  the arena in an iframe at /app/ (same origin)
   ▼
 ① workbench · FastAPI · :4900 · serve.py → server/
   │  steps, intent tasks, probes, the fake terminal, /api/env
   │  starts and stops ②; proxies /app/* to it
   │  mounts ADK web (the ADK dev UI) at /inspector, which can run ③ in-process
   ▼
 ② arena app · stdlib http.server · :8090 · app/main.py
   │  the fight state (engine.py), the spell card (sigil.py), the page (static/)
   │  "You fight": no model · "Discriminative model fights": calls the model
   │  "Workflow fights": starts ③ and draws what it posts back
   ▼
 ③ ADK workflow · scripts/arena.py → agents/arena/agent.py
      tick: the decision model, one call per tick ──────────────────► the decision model
                                                                      (step 2's choice, below)
      read_card, on its own branch: GET /api/sigil.png from ②,
               then four choice questions about the image ───────────────────────────► Gemini Decisions
                                                                      (gemini-decision-1)
      bard: the tale, once, after the fight ────────────────────────► Gemini
                                                                      (gemini-flash-latest)
      posts every decision and card reading back to ② over HTTP
```

**Who calls what.** The browser only ever talks to ①. The models are called
from Python on the machine, never from the page:

| Caller | Decision model (step 2's choice) | Gemini Decisions, on the card image | Gemini |
|---|---|---|---|
| ② arena, "Discriminative model fights" | every tick, `decisions.ask` | no | no |
| ③ workflow `tick` | every tick, `decisions.ask_async` | no | no |
| ③ workflow `read_card` | no | at the bell and after each cast, `decisions.ask_gemini_async` | no |
| ③ workflow `bard` | no | no | the tale after the fight |
| `scripts/first_call.py`, `ask.py`, `fight.py`, `branches/fight_loop.py` (run from the terminal) | yes | no | no |
| `branches/read_card.py` (run from the terminal) | no | yes | no |

**One tick, per mode.**

- *You fight.* The page asks ② for a telegraph, shows it with a 2 s timer,
  and posts the button you press (or the spell you type) back. ② resolves it.
- *Discriminative model fights.* The page asks ② for a tick; ② draws a
  telegraph, asks the model three questions in one call, runs `choose()`, and
  returns the answers and the outcome. The page draws the bars.
- *Workflow fights.* Start makes ② launch ③ as a subprocess (log in
  `runs/arena-workflow.log`). ③ drives the fight: it asks ② for each
  telegraph, calls the model, and posts the decision. `read_card` runs on its
  own branch at the same time, so the fight does not wait for it. The page only polls
  ② and draws. Pause is a flag on ② that ③ checks before each tick.

**How the model is called.** `scripts/decisions.py` holds both calls behind
`ask(about, questions)` and `ask_async(about, questions)`. `about` is what the model judges; it goes out as `state` with the TypeSafe SDK and as `input` with the Google Gen AI SDK. Questions are plain
dicts, `{"type": "choice"|"noul"|"score", "instructions": ..., "criteria": ...}`,
and the answers have the same fields from either SDK. Call sites use
`decisions.ask` or `ask_async` and never make a client themselves.

| | Jev and DiffusionGemma | Gemini Decisions |
|---|---|---|
| Package | `typesafe-sdk` | `google-genai` |
| Call | `client.system_one(state=..., questions=...)` | `client.decisions.create(model="gemini-decision-1", input=..., questions=...)` |
| Request | `POST /v1/systemone` | `POST https://generativelanguage.googleapis.com/v1beta/decisions` |
| What to judge | `state`, an object or text | `input`, text or content blocks such as an image |

**Where the decision model lives.** `scripts/jevauth.py` names the backend
and sets the key and timeout. `JEV101_MODEL=gemini` selects Gemini Decisions;
otherwise the backend follows `TYPESAFE_BASE_URL`:

| Backend | `TYPESAFE_BASE_URL` | Key | Set up by |
|---|---|---|---|
| Jev on TypeSafe, hosted | unset (api.typesafe.ai) | `TYPESAFE_API_KEY` | step 2, or `setup_model.sh --model jev` |
| DiffusionGemma on your L4 VM | `http://127.0.0.1:8096`, the IAP tunnel | none | step 2, or `setup_model.sh --model gemma` |
| DiffusionGemma on Cloud Run | `https://djev-…run.app` | a Google identity token, fetched per hour | `setup_gemma_cloudrun.sh` |
| Any other Jev-compatible server | its address | none | by hand, in `.env` |
| Gemini Decisions, hosted | not used | `GEMINI_API_KEY` | step 2, or `setup_model.sh --model gemini` |

The spell card's answer never leaves ②. The workflow gets only the PNG, and ②
judges the reading it sends back.

## Repository layout

```
app/                the arena app, as built so far (see "The app, one stage at a time")
  main.py           the server, the "You fight" mode, and the plugin loader
  engine.py         the rules and the ogre's moves, the one copy
  sigil.py          spell cards: a color and three shapes, judged and drawn (a tiny PNG rasteriser)
  static/           the page: HP bars, the telegraph and timer, the spell card; modes/ holds plugins
  static/sounds/    bgm.mp3 plus optional effects: fight, ogre-attack, block, strike, hurt, charge,
                    cast, fizzle, ready, ko, timeup (.mp3). A missing file is silent. Add them in stages/03-you-fight/.
  reflex.py         step 5: the three questions and choose()
  mode_model.py     step 5: the server side of "Discriminative model fights"
  mode_workflow.py  step 6: the server side of "Workflow fights"
stages/             the source of app/: one folder per step, each laid on top of the last
agents/arena/agent.py   the ADK Workflow (root_agent), also served by ADK web at /inspector
branches/            step 6b's exercises: each part of the graph as a workflow of its own, nothing from the arena
  read_card.py      Gemini Decisions reads spell_card.png and is checked against spell_card.json
  fight_loop.py     the decision model decides on a list of moves, in a loop
  cards/            the spell cards the exercise can choose from
starter/            unedited copies of the files the exercises fill in (scripts/starter.sh restores from here):
                    scripts/first_call.py, branches/read_card.py, branches/fight_loop.py
scripts/
  setup_model.sh    chooses the decision model and checks it: --model jev|gemma|gemini
  decisions.py      ask() and ask_async(): the one call to the chosen model, through either SDK
  jevauth.py        where the decision model lives, and how to authenticate to it
  verify_jev_key.py     one real request with a TypeSafe API key
  verify_gemini_key.py  one real request to gemini-decision-1 with a Gemini API key
  pick_gemini_model.py  finds the Gemini model that writes the tale
  check_setup.py    what is and is not configured (exit 0 when the decision model is callable)
  stage.py          builds app/ up to a step: python3 scripts/stage.py 5
  first_call.py     the request step 5a fills in: TELEGRAPH and a choice question; --curl
  ask.py            any question, as noul / --choice / --score, about a telegraph
  fight.py          a whole fight in the terminal, the decision model only; --moves lists the ogre's repertoire
  arena.py          the ADK workflow with a timestamped timeline; plays on the app's screen when it is running
  fake_jev.py       a developer test stand-in for Jev's API (the TypeSafe SDK path); the workshop never uses it
content/            course.yaml + one directory per step (see "Authoring steps")
server/             FastAPI: content, intent matching, runs over SSE, probes, terminal, app proxy, ADK web
web/                React + Vite + Tailwind: the page
slides/             the source of the workshop's slides (see slides/README.md)
```

### The app, one stage at a time

Students see the arena grow. In step 3 `app/` holds only the game and the
"You fight" mode; there is no model code in it. Steps 5 and 6 each add a mode
as new files, with a task that runs:

```
python3 scripts/stage.py 5     # + reflex.py, mode_model.py, static/modes/model.{js,css}
python3 scripts/stage.py 6     # + mode_workflow.py, static/modes/workflow.js
python3 scripts/stage.py 3     # back to the start, before a workshop
python3 scripts/stage.py       # which stage app/ is at
```

`stages/` is the source; `app/` is built from it. Applying stage N rebuilds
`app/` from `stages/03-you-fight` and lays each later stage up to N on top, in
order, then restarts the arena app through the workbench. **Edit the files in
`stages/`**, then re-apply: a change made only in `app/` is overwritten.

Modes are plugins, so later stages add files instead of editing earlier ones.
`main.py` loads every `mode_*.py` it finds; each declares `MODE`, `LABEL`, and
the routes it adds. `/api/health` lists the modes, and `static/app.js` loads
`static/modes/<id>.js` for each; a plugin calls `registerMode()` and hooks
into drawing with `onHook()`.

The repository ships with `app/` at stage 3, where a workshop starts.

### ADK workflow

```
START ─► enter ─┬─► read_card ─► writes state["spell"]        "again" after a misread
                │       ▲
                │       └──── "read": a spell was cast, a new card is up
                │
                └─► tick ─┬─ "next" ─► tick                    reads state["spell"] every tick
                          └─ "done" ─► summarise ─► bard (Gemini) ─► finish
```

The graph is a fight loop with a card-reading branch beside it:

```python
("START", enter),
(enter, (read_card, tick)),                   # fan-out: read the card and fight, together
(read_card, {"again": read_card, "stored": rest}),
(tick, {"next": tick, "read": read_card, "done": summarise}),
(summarise, bard, finish),
```

`enter` rings the bell on the running app, or on an in-process engine when no
app is up. `tick` is an async function node. It awaits the chosen decision
model with `decisions.ask_async`, reads `state["spell"]` at the top of every
tick, offers `cast` only when a spell is ready, posts the decision to the
arena so the page can draw it, and returns `Event(route=[...])`. After a cast
the routes are `["read", "next"]`, which takes both edges at once.

`read_card` runs on its own branch, at the bell and after each cast. It
fetches the spell card the screen is showing as a PNG and sends it to Gemini
Decisions with four choice questions: `element`, `first`, `second` and
`third`. It posts the reading to the arena, which judges it against the
card's hidden answer, and writes the spell into state with no output, so the
branch never counts as a second ending of the graph. A misread card leaves no
spell and routes `"again"` to read the new card. The incantation is a fixed
line per element. Both branches are tasks on one event loop: while `tick`
awaits its model, `read_card` runs.

`bard` is an `LlmAgent` on Gemini. It writes the tale once, after the fight,
and is the only language model call in the workflow.

Gemini is `gemini-flash-latest` unless `JEV101_GEMINI_MODEL` says otherwise.
`JEV101_TICK_SECONDS` (default 0.5) paces the loop so a person can watch.
`JEV101_ARENA_URL` points the workflow at the app (default the app port).

### Game rules

Ten telegraphs, five responses. Every telegraph has a counter the engine
knows and the decision model does not. A right call counters for 3; a strike into an opening
does 8; a wrong call takes 12 or 24. The ogre has 300 hit points, so reflexes
alone end in a draw. A correctly read spell does 45, 67 into an opening. The
spell card is a border color and three shapes; Gemini Decisions reads the image
and the arena judges the reading, so the spell card's answer never leaves the server.

## Workbench

The engine is the Cloud 101 workbench with the Google Cloud course removed:

- **The terminal is not a shell.** `pwd`, `ls`, `cd`, `cat`, `clear`, and
  `python3 scripts/<name>.py [args]` (run on the workbench's own interpreter,
  so the SDKs are there) or `python3 main.py` from `app/`, which starts the
  real app process. Everything is confined to the repository.
- **Probes are read-only by construction:** only `curl`, `cat`, and `python3`
  on a file under `scripts/`, through argv and never a shell.
- **Intent tasks** take the student's words. Step 2 captures a quoted
  question and hands it to a script as an argument; step 6 starts the fight.
- **The app** runs as a separate process and is proxied at `/app`, so the
  iframe is same-origin.
- **ADK web** (ADK's development UI) is mounted at `/inspector` with
  `get_fast_api_app(url_prefix="/inspector")`, loading `agents/`. The
  `inspector` task kind can embed it (`/inspector/dev-ui/?app=arena`); no step
  uses it at the moment.
  A run started there executes inside the workbench process and plays on the
  arena app. `/api/inspector` reports whether it loaded.
- **Environment** (`/api/env`) reports whether the decision model and the Gemini API key are set up.
  `.env` at the root is read on every request, so a student can add a key
  without restarting.

Environment variables: `JEV101_MODEL` (`jev`, `gemma` or `gemini`),
`GEMINI_API_KEY`, `TYPESAFE_API_KEY`, `TYPESAFE_BASE_URL`, `JEV101_PORT`
(4900), `JEV101_APP_PORT` (8090, so it does not collide with other workshops
on 8080), `JEV101_GEMINI_MODEL`, `JEV101_TICK_SECONDS`, `JEV101_ARENA_URL`,
`JEV101_JEV_TIMEOUT` (seconds per decision call), `CLOUD101_AGENT_URL` (an
optional remote judge for intents, as in Cloud 101).

### Authoring steps

A step is a directory under `content/steps/` named `NN-slug`, with a
`step.yaml` and one markdown file per part. Markdown supports the same fenced
directives as Cloud 101: `:::section`, `:::figure`, `:::columns`, `:::key`,
`:::note`, `:::warn`. Figures are inline SVG in
`web/src/illustrations/index.tsx`; widgets in `web/src/widgets/`. Task kinds:
`intent`, `command`, `widget`, `files`, `terminal`, `app`, `console`,
`reflect`, `model-setup`, `assemble`, `edit`, `placeholder`.

Probe assertions: `succeeds`, `nonempty`, `equals`, `contains`,
`not_contains`, `matches`, `json_nonempty`, `json_count_gte`, `json_contains`.
A probe may use `$APP_PORT`, `$JEV_MODEL`, `$JEV_MODE`, `$HOME`, `$ROOT`.

## References

- TypeSafe docs: https://docs.typesafe.ai (primitives, confidence, patterns,
  cookbooks, models, API reference)
- Launch post: https://typesafe.ai/blog/introducing-system-one-models-and-jev
- Python SDK: https://github.com/typesafe-ai/typesafe-sdk-python
- Gemini API keys: https://aistudio.google.com/apikey
- ADK graph workflows: https://adk.dev/graphs/
- DiffusionGemma: https://ai.google.dev/gemma/docs/diffusiongemma ·
  Discriminative-model-style reads in vLLM: https://github.com/vllm-project/vllm/pull/57250 ·
  OpenJev: https://github.com/razorback16/openjev
- Independent tests: parallel.ai/blog/testing-jev; the DEV Community posts on
  the Discriminative model with Google ADK and on running System One models on Google Cloud
