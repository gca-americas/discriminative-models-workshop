/* Plugin: the workflow fights. Added in step 6, on top of step 5.

   Start launches the ADK workflow on the server (app/mode_workflow.py). From
   then on the workflow plays and this page only watches: it polls the fight
   and draws each tick, with the model's answer cards from step 5. When the
   workflow reads the spell card, the card in the corner lights up and the
   SPELL CARD panel shows the four answers Gemini Decisions gave. */

(() => {
  let pollHandle = null;
  let wasReady = false;
  let wasReading = false;
  let lastRead = "";

  // How the card was read: one card per question, above the fight's answers.
  const QUESTIONS = [
    ["element", "Element", "What color is the card? The color is its element."],
    ["first", "First shape", "Which shape is on the left?"],
    ["second", "Second shape", "Which shape is in the middle?"],
    ["third", "Third shape", "Which shape is on the right?"],
  ];
  const reading = `
    <style>#card-reading .bar-row { grid-template-columns: 58px 1fr 30px; }</style>
    <div id="card-reading" class="jev" hidden>
      <div class="label">SPELL CARD · what Gemini Decisions read <span id="read-label"></span></div>
      <div class="three" style="grid-template-columns: repeat(4, minmax(0, 1fr))">
        ${QUESTIONS.map(([id, title, hint]) => `
        <div class="panel">
          <div class="card-title">${title} <span class="prim">choice</span></div>
          <div class="card-hint">${hint}</div>
          <div id="read-${id}" class="bars"><div class="empty">not read yet</div></div>
          <div id="read-${id}-foot" class="foot"></div>
        </div>`).join("")}
      </div>
      <div id="read-meta" class="meta"></div>
    </div>
    <div id="tale-panel" class="jev" hidden>
      <div class="label">THE TALE · what Gemini wrote after the fight</div>
      <div class="panel">
        <div id="tale-title" class="card-title"></div>
        <div id="tale-text" class="card-hint" style="font-size: 13px; margin: 0"></div>
      </div>
    </div>`;
  if ($("answers")) $("answers").insertAdjacentHTML("beforebegin", reading);
  else $("mode-panels").insertAdjacentHTML("beforeend", reading);

  function bars(target, entries, winner) {
    target.innerHTML = "";
    for (const [name, value] of entries) {
      const row = document.createElement("div");
      row.className = "bar-row" + (name === winner ? " win" : "");
      row.innerHTML = `<span class="name"></span><div class="track"><div class="fill"></div></div><span class="value"></span>`;
      row.querySelector(".name").textContent = name;
      row.querySelector(".value").textContent = value.toFixed(2);
      target.appendChild(row);
      requestAnimationFrame(() => (row.querySelector(".fill").style.width = `${Math.round(value * 100)}%`));
    }
  }

  function drawReading(read) {
    for (const [id] of QUESTIONS) {
      const answer = read.answers[id];
      if (!answer) continue;
      const top = Object.entries(answer.probabilities).sort((a, b) => b[1] - a[1]).slice(0, 4);
      bars($(`read-${id}`), top, answer.choice);
      $(`read-${id}-foot`).innerHTML = `choice <b>${answer.choice}</b> · confidence <b>${answer.confidence.toFixed(2)}</b>`;
    }
    $("read-label").textContent = `· card ${read.n}`;
    $("read-meta").innerHTML = [
      `<span>model <b>${read.model || "?"}</b></span>`,
      `<span>latency <b>${read.latencyMs} ms</b></span>`,
      `<span>input tokens <b>${read.inputTokens}</b></span>`,
      `<span>the arena judged it <b>${read.verdict}</b> · ${read.damage} damage, more when cast into an opening</span>`,
    ].join("");
  }

  function clearReading() {
    lastRead = "";
    for (const [id] of QUESTIONS) {
      $(`read-${id}`).innerHTML = '<div class="empty">not read yet</div>';
      $(`read-${id}-foot`).innerHTML = "";
    }
    $("read-label").textContent = "";
    $("read-meta").innerHTML = "";
    $("tale-panel").hidden = true;
  }

  onHook("mode", (m) => {
    $("card-reading").hidden = m.id !== "workflow";
    if (m.id !== "workflow") $("tale-panel").hidden = true;
  });

  /* The spell corner follows the workflow: reading the card, then ready. */
  onHook("fight", (fight) => {
    if (mode !== "workflow") return;
    const ready = Boolean(fight.spell);
    const reading = fight.spellStatus === "forging" && !ready;
    if (reading && !wasReading) sfx("charge", 0.4);      // read_card starts
    wasReading = reading;
    if (reading) {
      $("spell-status").textContent = "READING… Gemini Decisions is reading the spell card";
    } else if (!ready) {
      $("spell-status").textContent = "EMPTY · waiting for the card reader";
    }
    const read = fight.lastRead;
    const readKey = read ? [read.n, read.tick, read.latencyMs].join(":") : "";
    if (read && readKey !== lastRead) {
      lastRead = readKey;
      drawReading(read);
    }
    // After the bell, the bard (Gemini) writes the tale. It takes a few seconds.
    $("tale-panel").hidden = !fight.over;
    if (fight.over) {
      $("tale-title").textContent = fight.tale ? fight.tale.title : "Gemini is writing the tale…";
      $("tale-text").textContent = fight.tale ? fight.tale.tale : "";
    }
    if (ready && !wasReady) {
      const corner = $("spell-corner");
      corner.classList.remove("ping", "ready-burst");
      void corner.offsetWidth;
      corner.classList.add("ready-burst");
      sfx("ready", 0.7);
    }
    wasReady = ready;
  });

  onHook("reset", () => {
    wasReady = false;
    wasReading = false;
    clearReading();
  });

  async function poll() {
    try {
      const state = await getJSON("api/fight");
      if (state.fight.mode === "workflow" && state.fight.tick === 0 && lastTick !== 0 && !state.fight.over) {
        lastTick = 0;
        running = true;
        $("start").textContent = "RESTART";
        splash("FIGHT!");
      }
      if (state.pending && state.fight.tick === lastTick) ogreTelegraph(state.pending.telegraph);
      if (state.fight.tick !== lastTick && state.last) {
        lastTick = state.fight.tick;
        showResult(state.last);
        drawOutcome(state.last.entry);
        drawLog(state.log);
      }
      drawFight(state.fight);
      if (running && !state.fight.over) {
        const wf = await getJSON("api/workflow");
        if (!wf.running && wf.exitCode !== null && wf.exitCode !== 0) {
          fail(new Error("the workflow stopped: " + (wf.tail.split("\n").pop() || `exit ${wf.exitCode}`)));
          $("outcome").textContent = wf.tail;
          return;
        }
        if (!paused) {
          $("status").textContent = state.fight.mode === "workflow" && state.fight.tick > 0
            ? "the workflow is fighting" : "the workflow is starting…";
        }
      }
    } catch (error) {
      fail(error);
    }
  }

  registerMode({
    id: "workflow",
    label: "Workflow fights",
    caption: "PRESS START TO RING THE BELL",
    controls: false,
    rules: false,
    showsAnswers: true,
    watches: true,
    pauseText: "paused · the fight waits after this exchange (a card being read still finishes)",
    async start() {
      $("caption").textContent = "RINGING THE BELL · STARTING THE ADK WORKFLOW…";
      $("status").textContent = "starting the workflow…";
      try {
        await post("api/workflow/start", {});
      } catch (error) {
        fail(error);
      }
    },
    resume() {
      $("status").textContent = "the workflow is fighting";
    },
    enter() {
      clearInterval(pollHandle);
      pollHandle = setInterval(poll, 300);
    },
    leave() {
      clearInterval(pollHandle);
      post("api/workflow/stop").catch(() => {});
    },
  });
})();
