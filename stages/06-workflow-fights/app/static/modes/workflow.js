/* Plugin: the workflow fights. Added in step 6, on top of step 5.

   Start launches the ADK workflow on the server (app/mode_workflow.py). From
   then on the workflow plays and this page only watches: it polls the fight
   and draws each tick, with the model's answer cards from step 5. After
   every exchange the workflow checks the spell slot, and the spell card in
   the corner pings. */

(() => {
  let pollHandle = null;
  let lastCheckTick = -1;
  let wasReady = false;
  let wasForging = false;

  /* Thread 2 glances at thread 1's slot once per tick: the corner pings,
     and bursts the first time the spell is ready. */
  onHook("fight", (fight) => {
    if (mode !== "workflow") return;
    const forging = fight.spellStatus === "forging" && !fight.spell;
    if (forging && !wasForging) sfx("charge", 0.4);      // Gemini starts reading the card
    wasForging = forging;
    if (!fight.spell && fight.spellStatus !== "forging") {
      $("spell-status").textContent = "EMPTY · waiting for the spellwright";
    } else if (fight.spellStatus === "forging" && !fight.spell) {
      $("spell-status").textContent = "SINGING… Gemini is reading the spell card";
    }
    const c = fight.lastCheck;
    if (!c || c.tick === lastCheckTick) return;
    lastCheckTick = c.tick;
    const corner = $("spell-corner");
    corner.classList.remove("ping", "ready-burst");
    void corner.offsetWidth;
    corner.classList.add(c.ready && !wasReady ? "ready-burst" : "ping");
    if (c.ready && !wasReady) sfx("ready", 0.7);
    wasReady = c.ready;
  });

  onHook("reset", () => {
    lastCheckTick = -1;
    wasReady = false;
    wasForging = false;
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
    pauseText: "paused · the workflow waits after this exchange (Gemini keeps singing)",
    async start() {
      // Thread 2 (the Discriminative model) starts ticking and thread 1
      // (Gemini) starts reading the spell card, at the same moment.
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
