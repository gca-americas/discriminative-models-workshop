/* Plugin: the Discriminative model fights. Added in step 5.

   Each tick the page asks the server for the ogre's move, then asks the
   server to respond; the server asks the model (app/mode_model.py). This
   file draws the model's three answers as cards under the ring. Any mode
   that marks itself `showsAnswers` gets the same cards. */

(() => {
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "modes/model.css";
  document.head.appendChild(css);

  $("mode-panels").insertAdjacentHTML("beforeend", `
    <div id="answers" class="jev" hidden>
      <div class="label">REFLEX · what the Discriminative model answered <span id="tick-label"></span></div>
      <div class="three">
        <div class="panel">
          <div class="card-title">Response <span class="prim">choice</span></div>
          <div class="card-hint">The model's answer: which move to make. The tallest bar wins; confidence says how sure.</div>
          <div id="response" class="bars"><div class="empty">no tick yet</div></div>
          <div id="response-foot" class="foot"></div>
        </div>
        <div class="panel">
          <div class="card-title">Exposed? <span class="prim">noul</span></div>
          <div class="card-hint">Is the ogre open to a counter right now? At 0.6+ with a spell ready, the code casts.</div>
          <div id="exposed" class="bars"></div>
        </div>
        <div class="panel">
          <div class="card-title">Danger <span class="prim">score</span></div>
          <div class="card-hint">How hard the hit lands if you do nothing. At 1.5+ with a shaky answer, the code dodges.</div>
          <div id="danger" class="bars"></div>
          <div id="danger-foot" class="foot"></div>
        </div>
      </div>
      <div id="meta" class="meta"></div>
    </div>`);

  // Where the model runs, in the pill at the top right.
  if (setup) {
    $("setup").hidden = false;
    $("setup").textContent = setup.backend === "rehearsal" ? "rehearsal · fake Discriminative model"
      : setup.backend === "cloud-run" ? "DiffusionGemma · Cloud Run"
      : setup.backend === "gemma-vm" ? "DiffusionGemma · GPU VM"
      : setup.backend === "self-hosted" ? "self-hosted · " + setup.baseUrl.replace(/^https?:\/\//, "")
      : setup.hasKey ? "live · api.typesafe.ai" : "no TYPESAFE_API_KEY";
  }

  function bars(target, entries, winner) {
    target.innerHTML = "";
    for (const [name, value] of entries) {
      const row = document.createElement("div");
      row.className = "bar-row" + (name === winner ? " win" : "");
      row.innerHTML = `<span class="name"></span><div class="track"><div class="fill"></div></div><span class="value"></span>`;
      row.querySelector(".name").textContent = name.replace("_", " ");
      row.querySelector(".value").textContent = value.toFixed(2);
      target.appendChild(row);
      requestAnimationFrame(() => (row.querySelector(".fill").style.width = `${Math.round(value * 100)}%`));
    }
  }

  /* The three answers, one card each. */
  onHook("result", (result) => {
    if (!result.answers) return;
    const { response, exposed, danger } = result.answers;
    const decision = result.decision;
    bars($("response"), Object.entries(response.probabilities).sort((a, b) => b[1] - a[1]), response.choice);
    $("response-foot").innerHTML =
      `choice <b>${response.choice}</b> · confidence <b>${response.confidence.toFixed(2)}</b>` +
      (decision.fallback ? ` · <span style="color:var(--orange)">under ${setup.thresholds.trustConfidence} with a heavy hit coming → ${decision.action}</span>` : "") +
      (decision.action === "cast" && response.choice !== "cast" ? ` · <span style="color:var(--violet)">opening + spell ready → cast</span>` : "");
    bars($("exposed"), [["yes", exposed.noul], ["no", 1 - exposed.noul]], exposed.noul >= 0.5 ? "yes" : "no");
    const levels = Object.entries(danger.legend);
    bars($("danger"), levels.map(([k, label]) => [label.split(":")[0].toLowerCase().replace(/^an? /, "").replace(/\.$/, ""), danger.probabilities[k] ?? 0]), null);
    $("danger-foot").innerHTML = `score <b>${danger.score.toFixed(2)}</b> of ${levels.length - 1}`;
    const totals = result.totals || { calls: 0, ms: 0, tokens: 0 };
    $("meta").innerHTML = [
      `<span>model <b>${result.model || "?"}</b></span>`,
      `<span>latency <b>${result.latencyMs} ms</b></span>`,
      `<span>input tokens <b>${result.inputTokens}</b></span>`,
      `<span>this fight <b>${totals.calls} calls · ${totals.ms} ms · $${(totals.tokens * 0.042 / 1e6).toFixed(6)}</b></span>`,
    ].join("");
  });

  onHook("fight", (fight) => {
    $("tick-label").textContent = fight.tick ? `· tick ${fight.tick}` : "";
  });

  onHook("reset", () => {
    $("response").innerHTML = '<div class="empty">no tick yet</div>';
    for (const id of ["exposed", "danger", "response-foot", "danger-foot", "meta"]) $(id).innerHTML = "";
  });

  onHook("mode", (m) => {
    $("answers").hidden = !m.showsAnswers;
  });

  /* One tick: the ogre moves, the server asks the model, the page draws. */
  async function modelTick() {
    if (!running || busy || paused || mode !== "model") return;
    const g = gen;
    busy = true;
    try {
      const { pending } = await post("api/fight/telegraph");
      ogreTelegraph(pending.telegraph);
      $("status").textContent = "asking the Discriminative model…";
      const result = await post("api/fight/respond");
      if (g !== gen) return;
      showResult(result);
      drawOutcome(result.entry);
      $("status").textContent = `${result.latencyMs} ms`;
      const state = await getJSON("api/fight");
      drawLog(state.log);
      drawFight(state.fight);
    } catch (error) {
      fail(error);
    } finally {
      if (g === gen) {
        busy = false;
        if (running && !paused) setTimeout(() => g === gen && modelTick(), 750);
      }
    }
  }

  registerMode({
    id: "model",
    label: "Discriminative model fights",
    caption: "PRESS START · THE MODEL READS EVERY TELEGRAPH",
    controls: false,
    showsAnswers: true,
    start() {
      splash("FIGHT!");
      setTimeout(modelTick, 900);
    },
    resume: modelTick,
  });
})();
