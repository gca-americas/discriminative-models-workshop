# Codelab update: bring the published lab in line with the `gemini-decisions-api` branch

For: the agent updating the codelab at https://codelabs.developers.google.com/codelabs/discriminative-models?hl=en
From: the tester session (jev-workshop-2a), 2026-11-11.

The published codelab describes the old design: two decision models (Jev, DiffusionGemma) plus "Rehearsal", Gemini on Vertex AI, and an ADK workflow with a slow branch and a fast branch (`read_rune` → `spellwright`). The branch `gemini-decisions-api` replaces all of that. This file lists, section by section, what the codelab says today and what it should say. The branch is the source of truth. Copy facts from the files named here, not from this summary, because the branch is still changing (see "Before you start").

## Before you start

1. **Wait for the branch to settle.** The implementing session is still applying `feedback.md`. When it finishes, it will add a "Response from the implementing session" section at the top of `feedback.md`. Read that first, and use the branch as it stands then. Items marked "in flux" below may change.
2. **Find the codelab source.** It is not in this repo: no claat or codelab markdown is checked in. It is probably a Google Doc exported with claat, or a markdown file elsewhere. Ask the course owner for it before editing. Do not try to edit the published page directly.
3. **Writing rules** (the owner's standing preferences):
   - Sentence-case headings, in the Google Docs style. No chatty titles.
   - Plain, practical wording.
   - No commentary tails: end each sentence on the fact.
   - Few colons and dashes.
4. **Keep:** the Google Cloud branding and the line "Brought to you by Google Cloud Americas' Advocacy team".
5. **Never publish** a key, project ID or account email in an example. Use `AIza...` and `apikey_...` placeholders.

## Global changes (every section)

| Today in the codelab | Change to | Source of truth |
|---|---|---|
| Title "Getting started with Discriminative (Jev/DiffusionGemma) models" | The title in `content/course.yaml` (`title:`). Today: "Getting started with Discriminative models (Jev/Gemini Decisions)". The tester flagged that it leaves out DiffusionGemma (in flux) | `content/course.yaml` |
| Two decision models, Jev and DiffusionGemma, plus Rehearsal | **Three** decision models: Jev (TypeSafe, hosted), DiffusionGemma (Google, open weights, on your GPU VM), Gemini Decisions (Google, hosted, `gemini-decision-1`). **Remove Rehearsal everywhere** (`scripts/rehearsal.sh` is deleted) | `README.md` Overview, `content/steps/00-introduction/step.md` |
| One SDK, `typesafe-sdk` | **Two SDKs, shown together**: `typesafe-sdk` for Jev and DiffusionGemma (`client.system_one(...)`), `google-genai` for Gemini Decisions (`client.decisions.create(model="gemini-decision-1", ...)`). The workshop wraps both in `scripts/decisions.py` | `README.md` "How the model is called" |
| Gemini runs on Vertex AI (`GOOGLE_GENAI_USE_VERTEXAI=1`, `GOOGLE_CLOUD_LOCATION=global`) | Gemini uses **one API key** on the Gemini Developer API: `GEMINI_API_KEY` from https://aistudio.google.com/apikey. **Remove every mention of Vertex AI** | `.env.example`, `README.md` Setup |
| Gemini reads the spell card image and writes the spell (`spellwright`) | **Gemini Decisions reads the spell card** (four choice questions about the image). **Gemini writes only the tale** at the end (`bard`) | `agents/arena/agent.py` |
| Slow branch / fast branch / parallel branches, `spellwright`, `read_rune`, `check_spell`, `spell_ready`, `recast`, `AsyncTypeSafeClient` | Gone. The new graph is in "Section 10" below. Do not use the words "slow branch", "fast branch", "parallel branch", "spellwright" or "rehearsal" anywhere | `agents/arena/agent.py`, `README.md` "ADK workflow" |
| `branches/slow_branch.py`, `branches/fast_branch.py` | `branches/read_card.py` and `branches/fight_loop.py` (both deleted files are gone from `branches/` and `starter/branches/`) | `README.md` Repository layout |
| "The Discriminative model" with a capital D, as a product name | "a discriminative model" as a generic term. The models are Jev, DiffusionGemma and Gemini Decisions | tester note in `feedback.md` |
| 90-minute, six-step workshop | The README now says about **sixty minutes**. The agenda covers steps 0 to 7 (4 + 6 + 8 + 6 + 9 + 9 + 12 + 3 = 57 min). Confirm with the owner | `README.md` Agenda |

## Section by section

The codelab's section order today is: Introduction, Setup, Summary, From conversation to decisions, Model serving architecture, Set up the model, Play the game manually, Discriminative model concepts, Automate decisions with the model, Combine models in an ADK workflow. The workbench pages are steps 0 to 7. Consider moving "Summary" (with clean-up) to the end, to match the workbench's step 7 ("Summary and next steps"), unless the owner wants it third on purpose.

### 1. Introduction
- Replace the single-model description with the three models:
  - **Jev:** `jev-1.13`, alias `jev-latest`, TypeSafe, about 70 to 500 ms, $0.042 per 1M input tokens.
  - **DiffusionGemma:** open weights, on an L4 VM in your project, behind Jev's API via djev-run.
  - **Gemini Decisions:** `gemini-decision-1`, Gemini Developer API, $0.10 per 1M input tokens with a no-cost tier, takes images.
  - Output tokens are free on the hosted models.
- Architecture: replace "Workflow `spellwright` and `bard` call Gemini; `tick` calls the model through `AsyncTypeSafeClient`" with the "Who calls what" table in `README.md`:
  - The arena and the workflow `tick` call the chosen decision model through `decisions.ask` / `ask_async`.
  - The workflow `read_card` calls Gemini Decisions on the card image.
  - `bard` calls Gemini once, for the tale.
  - `scripts/first_call.py`, `ask.py`, `fight.py` and `branches/fight_loop.py` call the decision model. `branches/read_card.py` calls Gemini Decisions.
  - The codelab today says the terminal scripts "call Gemini". That is wrong now.
- Backends table:
  - **Drop** the Rehearsal row.
  - **Add** the row: Gemini Decisions, hosted | `TYPESAFE_BASE_URL` not used | `GEMINI_API_KEY` | `setup_model.sh --model gemini`.
  - Add a note that `JEV101_MODEL=gemini` selects it.
  - Keep "Any other Jev-compatible server" only if the owner wants it (it is in the README).

### 2. Setup
- Keep the commands:
  ```
  git clone https://github.com/gca-americas/discriminative-models-workshop.git
  cd discriminative-models-workshop
  ./setup_project.sh
  ./setup_codelab.sh
  ```
  Check that the clone URL and the default branch hold the new code once `gemini-decisions-api` is merged. Do not publish the codelab before the merge.
- `setup_codelab.sh` description: it enables **Compute Engine and IAP** (for DiffusionGemma), **not Vertex AI**. It writes `GOOGLE_CLOUD_PROJECT` to `.env`, checks a Gemini API key already in `.env`, puts the exercise files in place, builds the page, starts the workbench on 4900, and runs `scripts/check_setup.py`. If `~/project_id.txt` is missing it asks for an existing project ID (commit 9058f36).
- **Replace** the `.env` block (`GOOGLE_GENAI_USE_VERTEXAI=1`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION=global`) with the README's block:
  ```
  GEMINI_API_KEY=...                       # Gemini Decisions, and step 6, whichever model you pick
  JEV101_MODEL=gemini                      # jev, gemma or gemini
  TYPESAFE_API_KEY=apikey_...              # Jev only
  TYPESAFE_BASE_URL=http://127.0.0.1:8096  # DiffusionGemma only, written by setup_gemma.sh
  GOOGLE_CLOUD_PROJECT=your-project        # DiffusionGemma's project
  ```
- Model options: Jev, DiffusionGemma, **Gemini Decisions**. **Remove Rehearsal.** Say that every choice also needs the Gemini API key, because step 6 reads the spell card with Gemini Decisions and writes the tale with Gemini.
- **In flux:** the owner asked for `setup_codelab.sh` to create the Gemini API key itself with `gcloud services api-keys create` (with retries), so the student does not visit AI Studio (`feedback.md`, setup item 1). If the implementing session ships it, say "setup creates your Gemini API key in the project" and keep the AI Studio link only as the fallback. If not, tell students to create the key at https://aistudio.google.com/apikey before step 2.
- DiffusionGemma VM details (g2-standard-4, L4 24 GB, driver 580, `nvidia/diffusiongemma-26B-A4B-it-NVFP4` 17.5 GB, djev-run, port 8080 behind the IAP tunnel on `localhost:8096`, `allow-iap-djev`, 100 GB disk, ~15 min first boot, ~2 min later) are unchanged. Re-check them against `README.md` "DiffusionGemma on a Compute Engine VM".
- VM commands:
  - Keep `gemma_warm.sh off/on`, `gemma_tunnel.sh start/stop/status`, `teardown_gemma.sh`.
  - Keep `setup_gemma.sh --dry-run`, but describe it as "preview the commands", not "rehearse".
- Repository layout:
  - `branches/` now holds `read_card.py`, `fight_loop.py`, `cards/`, `spell_card.png` and `spell_card.json`.
  - `starter/` restores `scripts/first_call.py`, `branches/read_card.py` and `branches/fight_loop.py`.
  - Add `stages/` (the source of `app/`, one folder per step) and `scripts/decisions.py` (one call to the chosen model, through either SDK).
  - Copy from `README.md` "Repository layout".
- Port:
  - The workbench is on 4900 through Web Preview.
  - The arena app runs on **8091** in practice. The README architecture still says 8090; check `scripts/start.sh` and the step 3 page for the final value before writing a port.

### 3. Summary (and clean-up)
- Clean-up: **remove** `./scripts/rehearsal.sh stop 2>/dev/null || true` (the script is deleted). The rest stays:
  ```
  cd ~/discriminative-models-workshop
  ./scripts/teardown_gemma.sh
  ./scripts/stop.sh
  cd ~
  rm -rf ~/discriminative-models-workshop ~/project_id.txt
  ```
- Add one clean-up line for the Gemini API key:
  - If setup created it: `gcloud services api-keys delete jev-workshop-gemini --project "$(cat ~/project_id.txt)"`, before the project file is removed.
  - If students made it in AI Studio: "delete the key in AI Studio".
  - Deleting the project also removes a key created in it.
- Lab summary takeaways: replace "separate branches" with the new step 6 (a fight loop with a card-reading branch beside it, Gemini Decisions reading the card, Gemini writing the tale). Mirror the "Lab summary" list in `content/steps/07-wrap-up/step.md`.
- Add the step 7 guidance: when to use code, a discriminative model, or a language model, and the limits table (Jev 64k tokens per request; Gemini Decisions 262k tokens and up to 1,000 questions; 255 options per Choice; 2 to 10 Score levels). Source: `content/steps/07-wrap-up/step.md`.

### 4. From conversation to decisions (workbench step 0)
- Model types: add Gemini Decisions next to Jev and DiffusionGemma.
- Component roles, language model row: **"Gemini writes the tale of the fight"**. The codelab says Gemini reads the image and writes the spell; both are wrong now. Reading the card is the discriminative model's job (Gemini Decisions).
- Source: `content/steps/00-introduction/step.md`.

### 5. Model serving architecture (workbench step 1)
- Comparison: add the Gemini Decisions column:
  - Google, hosted API, on the Gemini Developer API.
  - Endpoint `https://generativelanguage.googleapis.com`, key `GEMINI_API_KEY`, SDK `google-genai`.
  - Input: text, images, audio, video, PDF.
  - Cost: per input token, with a no-cost tier.
- Data flow:
  - Step 1 now reads "`scripts/decisions.py` hands the request to the SDK for the model you chose".
  - Add the Gemini Decisions path: the Google Gen AI SDK sends `POST /v1beta/decisions` to `generativelanguage.googleapis.com` with the key in `x-goog-api-key`, model `gemini-decision-1`.
  - All three return the same kind of answer.
- Add the "Two SDKs for the same request" table (package, client, call, `state` vs `input`, model, question types, answer fields). Source: `content/steps/01-serving/step.md`.

### 6. Set up the model (workbench step 2)
- SDK install: show both lines:
  ```
  pip install typesafe-sdk    # Jev, DiffusionGemma
  pip install google-genai    # Gemini Decisions
  ```
  Say that both are already in the workbench's environment, with `google-adk`.
- Keys:
  - Jev keys start with **`apikey_`**, not `ts-` (commit d81cd00). Use `TYPESAFE_API_KEY=apikey_...`.
  - Add `GEMINI_API_KEY=...` and say it is needed whatever model is chosen.
- Exercise: the picker has three cards. The owner asked for the Gemini key field to come first, with the TypeSafe key only for Jev (in flux; describe what the branch ships).
- "Why diffusion works here" stays, under DiffusionGemma only.
- Source: `content/steps/02-run-it/a-setup.md`, `step.yaml`.

### 7. Play the game manually (workbench step 3)
- Mostly unchanged.
- Check the port the student sees (8091) and the command (`cd app`, then `python3 main.py`).

### 8. Discriminative model concepts (workbench step 4)
- "Limits": **remove "image reading"** from what the model cannot do. Say that Jev and DiffusionGemma read text only, and that Gemini Decisions also reads images, audio, video and PDFs.
- Confidence:
  - Keep Jev's formula and DiffusionGemma's top-probability note.
  - Add how Gemini Decisions reports confidence, once the branch says it. The tester saw it return the top probability.
- Add the "worth knowing" notes for DiffusionGemma and Gemini Decisions (announced November 2026, `gemini-decision-1`, same three question types, no output tokens).
- Source: `content/steps/04-what-is-jev/*.md`.

### 9. Automate decisions with the model (workbench step 5)
- SDK usage:
  - Replace the TypeSafe-only snippet (`from typesafe_sdk import Choice, Noul, TypeSafeClient … client.system_one(state=…)`) with both SDK snippets, then the workshop helper.
  - The helper takes **`about=`**, not `state=`: `decisions.ask(about={...}, questions={...})` (renamed in `scripts/decisions.py`; check the final name in the branch, in flux).
  - Questions are plain dicts (`{"type": "choice", "instructions": ..., "criteria": RESPONSES}`) with the same answer fields from either SDK.
- 5a exercise: the student assembles TELEGRAPH and REQUEST in `scripts/first_call.py` (REQUEST first; commit 10ea8e9), then runs `python3 scripts/first_call.py`. `--curl` prints the raw request for the active model.
- Timing and cost:
  - Replace "each tick about 100 ms" with the numbers in `content/steps/05-jev-fights/c-numbers.md`.
  - Measured with Gemini Decisions: about 0.3 s per tick, $0.002 for a 60-tick fight.
  - Keep "speculative fan-out".
- Mode name: the arena mode is called "Discriminative model fights" in the branch. Use the branch's final label.

### 10. Combine models in an ADK workflow (workbench step 6)
This section changes the most. Rewrite it from `agents/arena/agent.py`, `README.md` "ADK workflow", and `content/steps/06-the-workflow/*.md`.

- Problem statement (300 HP; 3 for a right call, 8 for a strike into an opening; spells 45, 67 on an opening, 25 with two shapes right) is unchanged.
- **Division of labor:**
  - The decision model chosen in step 2 decides every tick (`tick`).
  - **Gemini Decisions reads the spell card** (`read_card`): it fetches the PNG the screen shows and asks four choice questions, `element`, `first`, `second` and `third`. The arena judges the reading against the card's hidden answer. A misread routes `"again"`.
  - Code holds the rules and casts on an opening (`choose()`). The incantation is a fixed line per element.
  - Gemini writes the tale once at the end (`bard`, an `LlmAgent`, `gemini-flash-latest` unless `JEV101_GEMINI_MODEL` says otherwise).
- **Graph**: replace the old edges with the branch's (copy from `agents/arena/agent.py`; today):
  ```python
  root_agent = Workflow(
      name="arena",
      edges=[
          ("START", enter),
          (enter, (read_card, tick)),                    # read the card and fight, together
          (read_card, {"again": read_card, "stored": rest}),
          (tick, {"next": tick, "read": read_card, "done": summarize}),
          (summarize, bard, finish),
      ],
  )
  ```
  - Node names: `read_card` (not `read_rune`), `summarize` (US spelling, not `summarise`).
  - There is no `spellwright`, `spell_ready`, `check_spell` or `recast`.
  - After a cast, `tick` returns both routes, `["read", "next"]`.
- Concurrency: keep the point that both branches are tasks on one event loop, so `read_card` runs while `tick` awaits its model. Do not call them "slow" and "fast" branches.
- **6b exercises:**
  - `branches/read_card.py` ("Ask about the color", "Send the image", then read cards from the picker).
  - `branches/fight_loop.py` ("Assemble tick", then run; five moves play).
- **6c:**
  - "Update game to workflow mode", then `python3 scripts/check_setup.py`, then Start in the arena.
  - The SPELL CARD panel shows the four answers with a confidence each. A spell is cast on an opening. A new card is read after each cast.
  - The tale is shown on the page after the fight (`finish` posts it to the arena; check the final UI).
- Dev UI: `adk web agents` from the workshop root is unchanged.
- Code style in examples:
  - The 6b `read_card` code creates the Gemini client. Do not copy `vertexai=False` into the codelab; the tester flagged it for removal (in flux).
  - Write "color", not "colour", in question text.

## How to check the update

1. Grep the new codelab text. None of these may appear: `rehearsal`, `Vertex`, `GOOGLE_GENAI_USE_VERTEXAI`, `GOOGLE_CLOUD_LOCATION`, `slow branch`, `fast branch`, `parallel branch`, `spellwright`, `read_rune`, `check_spell`, `slow_branch.py`, `fast_branch.py`, `ts-...`, `AsyncTypeSafeClient`.
2. Every command in the codelab exists in the branch: `ls` each script path it names.
3. Every model name, port, price and env var matches `README.md` and `content/` at the time of publishing.
4. Walk the codelab next to the workbench at http://localhost:4900. Each codelab section should match the workbench step it mirrors, sub-tabs included (4a/4b, 5a/5b/5c, 6a/6b/6c).
5. Send the draft to the tester session (jev-workshop-2a) for a read-through before publishing.
