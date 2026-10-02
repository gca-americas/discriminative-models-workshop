/* The arena page: the game, and the "You fight" mode.

   Other ways to play are plugins in modes/, added in later steps:
     modes/model.js      the Discriminative model fights   (step 5)
     modes/workflow.js   an ADK workflow fights             (step 6)

   The server lists the modes it has in /api/health. This page loads each
   plugin's script, and the plugin calls registerMode(). A plugin can use
   everything declared here: the shared state (mode, running, paused, gen…)
   and the drawing functions. The page never talks to a model: it draws what
   the server decided, and it makes the fighters move. */

const $ = (id) => document.getElementById(id);
let setup = null;
let mode = "manual";
let running = false;
let busy = false;
let paused = false;
let armTimer = null;          // manual mode: re-arms the countdown for the move on screen
let gen = 0;                 // bumps on every start/stop; stale loops check it and quit
let timerHandle = null;
let lastTick = -1;
let lastRune = null;
let prev = { you: 100, foe: 300 };
const MODES = {};            // id → mode, registered by this file and the plugins
const HOOKS = { result: [], fight: [], reset: [], mode: [] };
function registerMode(m) { MODES[m.id] = m; }
function onHook(name, fn) { HOOKS[name].push(fn); }
const runHooks = (name, ...args) => HOOKS[name].forEach((fn) => fn(...args));

async function getJSON(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || response.status);
  return payload;
}
const post = (path, body) =>
  getJSON(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

/* ── sound ──────────────────────────────────────────────────────────────
   Music starts when you insert a coin (Start) and stops when the fight is
   over, so the K.O. lands on its own. Pause and the sound toggle stop it
   too. Effects are short files in sounds/, one
   per moment; a file that is not there is simply silent, so they can be
   added one at a time. The toggle at the top right is remembered. */

const SOUND_FILES = {
  fight: "fight",            // the bell: FIGHT!
  attack: "ogre-attack",     // the ogre winds up an attack
  block: "block",            // right call: you counter
  strike: "strike",          // your strike lands in an opening
  hurt: "hurt",              // you take a hit
  charge: "charge",          // a spell starts: typing, or Gemini reading
  cast: "cast",              // the spell flies
  fizzle: "fizzle",          // a wrong spell
  ready: "ready",            // the workflow's spell is ready
  ko: "ko",                  // someone goes down
  timeup: "timeup",          // time over, a draw
};
let soundOn = true;
try { soundOn = localStorage.getItem("arena.sound") !== "off"; } catch {}
const bgm = new Audio("sounds/bgm.mp3");
bgm.loop = true;
bgm.volume = 0.3;
const silent = new Set();       // effects with no file; not asked for again

function sfx(name, volume = 0.8) {
  if (!soundOn || silent.has(name)) return;
  const effect = new Audio(`sounds/${SOUND_FILES[name] || name}.mp3`);
  effect.volume = volume;
  effect.onerror = () => silent.add(name);
  effect.play().catch(() => {});
}

function music(on) {
  if (on && soundOn) bgm.play().catch(() => {});
  else bgm.pause();
}

function setSound(on) {
  soundOn = on;
  try { localStorage.setItem("arena.sound", on ? "on" : "off"); } catch {}
  $("sound").textContent = on ? "SOUND ON" : "SOUND OFF";
  $("sound").classList.toggle("off", !on);
  music(on && running && !paused);
}

/* ── the stage: animations ───────────────────────────────────────────── */

const OGRE_MOVES = [
  [/raises its club high|over its head|overhead/i, "windup-high"],
  [/swings its club low|knees/i, "sweep-low"],
  [/charges|shoulder/i, "charge"],
  [/hurls|rock|throws .* at/i, "throw"],
  [/kicks dust|lunges low/i, "sweep-low"],
  [/staggers|off balance|guard wide open/i, "stagger"],
  [/roars|head back/i, "roar"],
  [/gasps|breath|dragging/i, "winded"],
  [/circles|watching/i, "circle"],
  [/twitches|grins|feint/i, "feint"],
];
const HERO_STATES = ["block-high", "block-low", "dodge", "strike", "cast", "wait", "hit", "ko"];
const OGRE_STATES = ["windup-high", "sweep-low", "charge", "throw", "stagger", "roar", "winded", "circle", "feint", "hit", "ko"];

function setState(el, states, next, idle = true) {
  el.classList.remove(...states, "idle");
  void el.offsetWidth;                          // restart the animation
  if (next) el.classList.add(next);
  if (idle) el.classList.add("idle");
}

/* The ogre's move, called out over the ogre. Named, not judged: saying "an
   opening" here would answer the question the fighter is being asked. */
const OGRE_CALLOUTS = {
  "windup-high": ["OVERHEAD SMASH!", "attack"],
  "sweep-low": ["LOW SWEEP!", "attack"],
  charge: ["CHARGE!", "attack"],
  throw: ["ROCK THROW!", "attack"],
  stagger: ["STAGGERS!", "shift"],
  roar: ["ROARS!", "shift"],
  winded: ["GASPS!", "shift"],
  circle: ["CIRCLES…", "shift"],
  feint: ["TWITCHES…", "shift"],
};
let lastTelegraph = "";

function ogreTelegraph(text) {
  const found = OGRE_MOVES.find(([re]) => re.test(text));
  const state = found ? found[1] : "feint";
  $("caption").textContent = text;
  $("caption").classList.add("hot");
  // The watcher polls; only a new move gets a new animation and callout.
  const key = `${$("round-timer").textContent}|${text}`;
  if (key === lastTelegraph) return;
  lastTelegraph = key;
  setState($("ogre"), OGRE_STATES, state);
  const [label, cls] = found ? OGRE_CALLOUTS[state] : ["???", "shift"];
  $("fx").querySelectorAll(".callout.ogre").forEach((old) => old.remove());
  const el = document.createElement("div");
  el.className = `callout ogre ${cls}`;
  el.innerHTML = '<div class="callout-main"></div>';
  el.querySelector(".callout-main").textContent = label;
  $("fx").appendChild(el);
  setTimeout(() => el.remove(), 1300);
  if (cls === "attack") sfx("attack", 0.6);
}

function floatNumber(text, cls, side) {
  const fx = $("fx");
  const el = document.createElement("div");
  el.className = `dmg ${cls}`;
  el.textContent = text;
  el.style.left = side === "you" ? "70px" : "auto";
  el.style.right = side === "you" ? "auto" : "90px";
  el.style.top = `${70 + Math.random() * 40}px`;
  fx.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

/* What the fighter did, called out over their head, the way damage floats. */
const CALLOUTS = {
  block_high: ["BLOCK HIGH!", "block"],
  block_low: ["BLOCK LOW!", "block"],
  dodge: ["DODGE!", "dodge"],
  strike: ["STRIKE!", "strike"],
  wait: ["WAIT…", "wait"],
};

function callout(e) {
  let text, cls, sub = "";
  if (e.action === "cast" && e.spell) {
    castAnimation(e.spell);
    sfx("cast");
    [text, cls] = ["CAST SPELL!", "cast"];
  } else if (e.typed && !e.typed.damage) {
    sfx("fizzle");
    [text, cls, sub] = ["FIZZLE…", "wait", "wrong card"];
  } else {
    [text, cls] = CALLOUTS[e.action] || [e.action.toUpperCase(), "wait"];
    if (e.fallback) sub = "safe fallback";
  }
  $("fx").querySelectorAll(".callout:not(.ogre)").forEach((old) => old.remove());   // one at a time
  const el = document.createElement("div");
  el.className = `callout ${cls}`;
  el.innerHTML = `<div class="callout-main"></div>${sub ? '<div class="callout-sub"></div>' : ""}`;
  el.querySelector(".callout-main").textContent = text;
  if (sub) el.querySelector(".callout-sub").textContent = sub;
  $("fx").appendChild(el);
  setTimeout(() => el.remove(), cls === "cast" ? 1900 : 1200);
}

function splash(text, cls = "") {
  const el = $("splash");
  el.textContent = text;
  el.className = `splash ${cls}`;
  el.hidden = false;
  clearTimeout(splash.handle);
  splash.handle = setTimeout(() => (el.hidden = true), cls.includes("ko") ? 3000 : 1400);
}

function stageShake(flash = false) {
  const stage = $("stage");
  stage.classList.remove("shake", "flash");
  void stage.offsetWidth;
  stage.classList.add("shake");
  if (flash) stage.classList.add("flash");
  setTimeout(() => stage.classList.remove("shake", "flash"), 450);
}

/* What happened this tick, as motion. */
function animateOutcome(e) {
  $("caption").textContent = e.telegraph;
  $("caption").classList.remove("hot");
  const heroState = e.action === "block_high" ? "block-high"
    : e.action === "block_low" ? "block-low"
    : e.action === "cast" ? "cast"
    : e.action;                                 // dodge, strike, wait
  setState($("hero"), HERO_STATES, heroState);
  callout(e);

  setTimeout(() => {
    if (e.dealt) {
      setState($("ogre"), OGRE_STATES, "hit");
      floatNumber(`-${e.dealt}`, e.spell_used ? "spell" : "ogre", "ogre");
      if (e.spell_used) stageShake(true);
    }
    if (e.took) {
      setState($("hero"), HERO_STATES, "hit");
      floatNumber(`-${e.took}`, "you", "you");
      stageShake(false);
    }
    if (!e.dealt && !e.took && e.action !== "wait") floatNumber("MISS", "miss", "ogre");
    if (e.took) sfx("hurt");                          // wrong call, or too slow
    else if (e.spell_used) {}                         // the cast has its own sound
    else if (e.dealt && e.action === "strike") sfx("strike");
    else if (e.dealt) sfx("block");                   // right call: the counter
  }, 260);
}

/* A cast: the corner rune flies to the ogre and bursts in its element's colour. */
const ELEMENT_COLOURS = { fire: "#ff6b3d", frost: "#6cc8ff", earth: "#7ed36b", storm: "#b58cff" };

function castAnimation(spell) {
  const stage = $("stage");
  const from = $("rune-frame").getBoundingClientRect();
  const to = $("ogre").getBoundingClientRect();
  const origin = stage.getBoundingClientRect();
  const colour = ELEMENT_COLOURS[String(spell.element || "").toLowerCase()] || "#b58cff";
  const bolt = document.createElement("img");
  bolt.src = $("rune").src;
  bolt.className = "spell-bolt";
  bolt.style.left = `${from.left - origin.left}px`;
  bolt.style.top = `${from.top - origin.top}px`;
  bolt.style.width = `${from.width}px`;
  bolt.style.boxShadow = `0 0 18px 6px ${colour}`;
  stage.appendChild(bolt);
  const dx = to.left + to.width * 0.45 - from.left - from.width / 2;
  const dy = to.top + to.height * 0.35 - from.top - from.height / 2;
  bolt.animate([
    { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(1.3) rotate(180deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(0.6) rotate(360deg)`, opacity: 0.9 },
  ], { duration: 520, easing: "ease-in" }).onfinish = () => {
    bolt.remove();
    const burst = document.createElement("div");
    burst.className = "spell-burst";
    burst.style.left = `${to.left - origin.left + to.width * 0.45}px`;
    burst.style.top = `${to.top - origin.top + to.height * 0.35}px`;
    burst.style.setProperty("--burst", colour);
    stage.appendChild(burst);
    setTimeout(() => burst.remove(), 650);
  };
}

/* ── drawing ─────────────────────────────────────────────────────────── */

function drawFight(fight) {
  const youPct = (100 * fight.you) / fight.max.you;
  const foePct = (100 * fight.foe) / fight.max.foe;
  $("hp-you").style.width = `${youPct}%`;
  $("hp-foe").style.width = `${foePct}%`;
  $("hp-you-trail").style.width = `${youPct}%`;
  $("hp-foe-trail").style.width = `${foePct}%`;
  $("hp-you").classList.toggle("low", youPct <= 25);
  $("hp-foe").classList.toggle("low", foePct <= 25);
  $("hp-you-text").textContent = fight.you;
  $("hp-foe-text").textContent = fight.foe;
  $("round-timer").textContent = Math.max(0, fight.max.ticks - fight.tick);
  prev = { you: fight.you, foe: fight.foe };

  const status = $("spell-status");
  const frame = $("rune-frame");
  const corner = $("spell-corner");
  const cornerState = mode === "manual" && running ? "typeable"
    : fight.spell ? "ready" : fight.spellStatus === "forging" ? "forging" : "empty";
  ["empty", "forging", "ready", "typeable"].forEach((c) => corner.classList.toggle(c, c === cornerState));
  const tag = $("spell-tag");
  const tagText = { forging: "CASTING SPELL…", ready: "SPELL READY!", typeable: "PICK TO CAST" }[cornerState] || "";
  if (tag.textContent !== tagText) {
    tag.textContent = tagText;
    tag.className = `spell-tag ${cornerState}`;
    void tag.offsetWidth;
    tag.classList.add("pop");
  }
  if (fight.spell) {
    status.textContent = `READY · ${fight.spell.verdict} (${fight.spell.damage} dmg). Cast on the next opening.`;
    status.className = "spell-line ready";
    frame.className = "rune-frame ready";
    $("spell-song").textContent = `“${fight.spell.incantation}”`;
  } else if (fight.spellStatus === "forging") {
    status.textContent = "SINGING… the spell card is being read";
    status.className = "spell-line forging";
    frame.className = "rune-frame forging";
    $("spell-song").textContent = "";
  } else {
    status.textContent = "EMPTY · pick the spell card's color and shapes, then CAST";
    status.className = "spell-line";
    frame.className = "rune-frame";
    $("spell-song").textContent = "";
  }
  if (fight.sigil.id !== lastRune) {
    lastRune = fight.sigil.id;
    $("rune").src = `api/sigil.png?r=${fight.sigil.id}`;
  }
  runHooks("fight", fight);
  const castings = $("castings");
  const n = (fight.castings || []).length;
  $("castings-count").textContent = n ? `· ${n}` : "";
  castings.innerHTML = "";
  for (const c of [...(fight.castings || [])].reverse()) {
    const line = document.createElement("div");
    line.className = c.damage >= 45 ? "hit" : c.damage ? "" : "miss";
    line.textContent = `card ${c.rune}: ${c.element} · ${(c.glyphs || []).join(", ")} → ${c.verdict} (${c.damage})`;
    castings.appendChild(line);
  }

  if (fight.over && running) {
    stop();
    // After the last hit's own animation (it lands 260 ms after the outcome).
    music(false);                                     // the fight is over: the music ends
    sfx(fight.foe <= 0 || fight.you <= 0 ? "ko" : "timeup", 0.9);
    if (fight.foe <= 0) { splash("K.O.", "ko"); setTimeout(() => setState($("ogre"), OGRE_STATES, "ko", false), 800); }
    else if (fight.you <= 0) { splash("K.O.", "ko"); setTimeout(() => setState($("hero"), HERO_STATES, "ko", false), 800); }
    else splash("TIME OVER · DRAW", "ko small");
    $("caption").textContent = fight.result.toUpperCase();
    $("caption").classList.remove("hot");
    $("outcome").innerHTML = `<b>${fight.result}.</b> ` + $("outcome").innerHTML;
    $("status").textContent = "";
  }
}

function drawLog(log) {
  const list = $("log");
  $("log-count").textContent = log.length ? `· ${log.length} ${log.length === 1 ? "tick" : "ticks"}` : "";
  list.innerHTML = "";
  for (const entry of [...log].reverse()) {
    const item = document.createElement("li");
    if (entry.spell_used) item.className = "spell";
    item.innerHTML = `<span class="n"></span><span><span class="did"></span> <span class="t"></span></span><span class="ms"></span>`;
    item.querySelector(".n").textContent = entry.tick;
    item.querySelector(".did").textContent = entry.action + (entry.fallback ? "*" : "");
    item.querySelector(".t").textContent = entry.text;
    item.querySelector(".ms").textContent = `${entry.took ? "−" + entry.took : ""} ${entry.dealt ? "+" + entry.dealt : ""}`;
    list.appendChild(item);
  }
}

/* A tick's full result, with whatever a mode wants to draw from it (the
   model's answer cards, for example). */
function showResult(result) {
  if (result) runHooks("result", result);
}

function drawOutcome(e) {
  $("outcome").innerHTML =
    `<b>${e.action.replace("_", " ")}</b>${e.fallback ? ' <span class="fallback">(safe fallback)</span>' : ""} — ${e.text}` +
    (e.took ? ` <span class="took">−${e.took} you</span>` : "") +
    (e.dealt ? ` <span class="dealt">−${e.dealt} ogre</span>` : "");
  animateOutcome(e);
}

function drawRules() {
  const table = $("rules-table");
  table.innerHTML = "";
  for (const [cue, response, what] of setup.rules) {
    const row = document.createElement("tr");
    row.innerHTML = "<td></td><td></td><td></td>";
    row.children[0].textContent = "the ogre " + cue;
    row.children[1].textContent = response.toUpperCase();
    row.children[2].textContent = what;
    table.appendChild(row);
  }
}

/* ── manual mode: read, decide, press ────────────────────────────────── */

function setButtons(enabled) {
  document.querySelectorAll(".act").forEach((b) => {
    b.disabled = !enabled;
    b.classList.remove("chosen");
  });
  drawSpellBuilder();
}

async function manualTick() {
  if (!running || busy || paused || mode !== "manual") return;
  const g = gen;
  busy = true;
  const { pending, fight } = await post("api/fight/telegraph");
  if (g !== gen) return;
  ogreTelegraph(pending.telegraph);
  armTimer = () => {
    // A full two seconds again after a pause: the move is still on screen.
    setButtons(true);
    const total = fight.reactionSeconds * 1000;
    const started = performance.now();
    $("timer-fill").style.width = "100%";
    clearInterval(timerHandle);
    timerHandle = setInterval(() => {
      const left = Math.max(0, 1 - (performance.now() - started) / total);
      $("timer-fill").style.width = `${left * 100}%`;
      if (left <= 0) {
        clearInterval(timerHandle);
        manualRespond("wait", true);
      }
    }, 40);
  };
  armTimer();
}

async function manualRespond(action, timedOut = false) {
  if (!running || paused || mode !== "manual") return;
  const g = gen;
  armTimer = null;
  clearInterval(timerHandle);
  setButtons(false);
  $("timer-fill").style.width = "0%";
  try {
    const result = await post("api/fight/respond", { action });
    drawOutcome(result.entry);
    if (timedOut) $("outcome").innerHTML = '<span class="fallback">TOO SLOW — you waited.</span> ' + $("outcome").innerHTML;
    const state = await getJSON("api/fight");
    drawLog(state.log);
    drawFight(state.fight);
  } catch (error) {
    fail(error);
  } finally {
    if (g === gen) {
      busy = false;
      if (running && !paused) setTimeout(() => g === gen && manualTick(), 1000);
    }
  }
}

/* You fight: pick the spell card's color and shapes, then CAST. The clock
   keeps running while you pick. */
async function manualCast(text) {
  if (!running || paused || mode !== "manual" || !armTimer) return;
  const g = gen;
  armTimer = null;
  clearInterval(timerHandle);
  setButtons(false);
  $("timer-fill").style.width = "0%";
  try {
    const result = await post("api/fight/cast", { text });
    drawOutcome(result.entry);
    const state = await getJSON("api/fight");
    drawLog(state.log);
    drawFight(state.fight);
  } catch (error) {
    fail(error);
  } finally {
    if (g === gen) {
      busy = false;
      if (running && !paused) setTimeout(() => g === gen && manualTick(), 1000);
    }
  }
}

/* ── controls ────────────────────────────────────────────────────────── */

function fail(error) {
  $("status").textContent = String(error.message || error);
  $("status").className = "status bad";
  stop();
}

function stop() {
  music(false);                  // music only plays while a fight runs
  gen += 1;
  busy = false;
  running = false;
  paused = false;
  armTimer = null;
  $("pause").textContent = "Pause";
  clearInterval(timerHandle);
  setButtons(false);
  $("timer-fill").style.width = "0%";
  $("start").textContent = "INSERT COIN · START";
  $("start").classList.remove("live");
  $("pause").hidden = true;
}

async function start() {
  stop();
  $("status").className = "status";
  $("status").textContent = "";
  $("outcome").textContent = "";
  const state = await post("api/fight/new", { mode });
  lastTick = MODES[mode].watches ? -1 : 0;
  drawLog([]);
  clearSpell();
  setState($("hero"), HERO_STATES, null);
  setState($("ogre"), OGRE_STATES, null);
  drawFight(state.fight);
  runHooks("reset");
  running = true;
  drawFight(state.fight);                             // the spell card lights up for this mode
  $("start").textContent = "RESTART";
  $("start").classList.add("live");
  $("pause").hidden = false;
  sfx("fight", 0.9);
  bgm.currentTime = 0;                                // each fight starts the music afresh
  music(true);
  MODES[mode].start();
}

function setMode(next) {
  if (!MODES[next]) next = "manual";
  if (MODES[mode] && mode !== next) MODES[mode].leave?.();
  mode = next;
  stop();
  const m = MODES[mode];
  document.querySelectorAll(".mode").forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
  $("buttons").hidden = !m.controls;
  $("spellcast-row").hidden = !m.controls;
  $("timer").hidden = !m.controls;
  $("rules").hidden = m.rules === false;
  $("caption").textContent = m.caption;
  $("caption").classList.remove("hot");
  runHooks("mode", m);
  m.enter?.();
  try { localStorage.setItem("arena.mode", mode); } catch {}
}

/* "You fight": this file's own mode, registered the same way the plugins are. */
registerMode({
  id: "manual",
  label: "You fight",
  caption: "PRESS START · TWO SECONDS PER MOVE · KEYS 1–5",
  controls: true,
  start() {
    splash("FIGHT!");
    setTimeout(manualTick, 900);
  },
  resume() {
    if (armTimer) armTimer(); else manualTick();
  },
});

function drawModeButtons(list) {
  const bar = $("modes");
  bar.innerHTML = "";
  for (const { id } of list) {
    const m = MODES[id];
    if (!m) continue;
    const b = document.createElement("button");
    b.className = "mode";
    b.dataset.mode = id;
    b.textContent = m.label;
    b.onclick = () => { pickedByHand = true; setMode(id); };
    bar.appendChild(b);
  }
}

function loadScript(src) {
  return new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = src;
    tag.onload = resolve;
    tag.onerror = resolve;            // a missing plugin leaves its mode out, nothing more
    document.body.appendChild(tag);
  });
}

let pickedByHand = false;   // a click beats the saved mode, however slow startup is
document.querySelectorAll(".act").forEach((b) => (b.onclick = () => {
  b.classList.add("chosen");
  manualRespond(b.dataset.action);
}));
/* The spell builder. The pieces picked stay put while the clock runs, so a
   spell can be built over several moves while the keys 1-5 keep answering
   the ogre. CAST sends it as the response to the move on screen. */
const SPELL_COLORS = { fire: "#e85838", frost: "#56aaf0", earth: "#6eb45a", storm: "#a86ef0" };
const SHAPE_ICONS = {
  circle: '<circle r="7.5"/>',
  ring: '<circle r="6.2" fill="none" stroke="currentColor" stroke-width="3"/>',
  square: '<rect x="-6.6" y="-6.6" width="13.2" height="13.2"/>',
  diamond: '<polygon points="0,-8.6 8.6,0 0,8.6 -8.6,0"/>',
  triangle: '<polygon points="0,-7.4 7.4,6.6 -7.4,6.6"/>',
  cross: '<rect x="-1.9" y="-7.9" width="3.8" height="15.8"/><rect x="-7.9" y="-1.9" width="15.8" height="3.8"/>',
  crescent: '<path d="M4.61 -5.91 A7.5 7.5 0 1 0 4.61 5.91 A6 6 0 0 1 4.61 -5.91 Z"/>',
  bar: '<rect x="-8.2" y="-1.7" width="16.4" height="3.4"/>',
};
const icon = (shape, colour) =>
  `<svg viewBox="-12 -12 24 24" fill="currentColor" style="color:${colour}" aria-hidden="true">${SHAPE_ICONS[shape]}</svg>`;
const spell = { color: "", shapes: [] };

function drawSpellBuilder() {
  const live = running && !paused && mode === "manual";
  const colour = SPELL_COLORS[spell.color] || "var(--muted)";
  const slots = [
    `<div class="spell-slot color-slot${spell.color ? " filled" : ""}" style="${spell.color ? `background:${colour};border-color:${colour}` : ""}">${spell.color.toUpperCase()}</div>`,
    ...[0, 1, 2].map((i) => `<div class="spell-slot${spell.shapes[i] ? " filled" : ""}" style="border-color:${spell.shapes[i] ? colour : ""}">${spell.shapes[i] ? icon(spell.shapes[i], colour) : ""}</div>`),
  ];
  $("spell-slots").innerHTML = slots.join("");
  document.querySelectorAll("#spell-colors button").forEach((b) => {
    b.classList.toggle("on", b.dataset.color === spell.color);
    b.disabled = !live;
  });
  document.querySelectorAll("#spell-shapes button").forEach((b) => {
    b.innerHTML = icon(b.dataset.shape, colour);
    b.disabled = !live || spell.shapes.length >= 3;
  });
  $("spell-clear").disabled = !live || (!spell.color && !spell.shapes.length);
  $("spell-cast").disabled = !(live && armTimer && spell.color && spell.shapes.length === 3);
}

function pickSpellPiece(kind, value) {
  if (!running || paused || mode !== "manual") return;
  if (!spell.color && !spell.shapes.length) sfx("charge", 0.5);        // a spell begins
  if (kind === "color") spell.color = value;
  else if (spell.shapes.length < 3) spell.shapes.push(value);
  drawSpellBuilder();
}

function clearSpell() {
  spell.color = "";
  spell.shapes = [];
  drawSpellBuilder();
}

(function buildSpellButtons() {
  $("spell-colors").innerHTML = Object.entries(SPELL_COLORS)
    .map(([name, c]) => `<button type="button" data-color="${name}" style="background:${c}">${name.toUpperCase()}</button>`).join("");
  $("spell-shapes").innerHTML = Object.keys(SHAPE_ICONS)
    .map((name) => `<button type="button" data-shape="${name}" title="${name}" aria-label="${name}"></button>`).join("");
  document.querySelectorAll("#spell-colors button").forEach((b) => (b.onclick = () => pickSpellPiece("color", b.dataset.color)));
  document.querySelectorAll("#spell-shapes button").forEach((b) => (b.onclick = () => pickSpellPiece("shape", b.dataset.shape)));
  $("spell-clear").onclick = clearSpell;
  $("spell-cast").onclick = () => {
    if ($("spell-cast").disabled) return;
    const text = [spell.color, ...spell.shapes].join(" ");
    clearSpell();
    manualCast(text);
  };
  drawSpellBuilder();
})();

const RESPONSE_KEYS = { "1": "block_high", "2": "block_low", "3": "dodge", "4": "strike", "5": "wait" };
document.addEventListener("keydown", (event) => {
  if (mode !== "manual" || !running) return;
  const action = RESPONSE_KEYS[event.key];
  if (action && armTimer) manualRespond(action);
});
$("start").onclick = start;
/* Pause holds the fight between exchanges; Resume carries on from there.
   The server holds the flag too, so anything playing from outside the page
   can wait on it. */
async function setPaused(next) {
  paused = next;
  $("pause").textContent = paused ? "Resume" : "Pause";
  await post("api/fight/pause", { paused }).catch(() => {});
  music(!paused);
  if (paused) {
    clearInterval(timerHandle);
    setButtons(false);
    $("status").textContent = MODES[mode].pauseText || "paused";
    $("caption").classList.remove("hot");
    return;
  }
  $("status").textContent = "";
  MODES[mode].resume?.();
}
$("pause").onclick = () => { if (running) setPaused(!paused); };
$("sound").onclick = () => setSound(!soundOn);
setSound(soundOn);

(async () => {
  let modes = [{ id: "manual" }];
  try {
    setup = await getJSON("api/health");
    modes = setup.modes || modes;
    $("setup").hidden = true;            // a model plugin shows where its model runs
    drawRules();
  } catch {
    $("setup").textContent = "server?";
  }
  // One plugin script per mode the server has, in the server's order.
  for (const { id } of modes) {
    if (id !== "manual") await loadScript(`modes/${id}.js`);
  }
  drawModeButtons(modes);
  let saved = "manual";
  try { saved = localStorage.getItem("arena.mode") || "manual"; } catch {}
  const wanted = new URLSearchParams(location.search).get("mode") || saved;
  if (!pickedByHand) setMode(MODES[wanted] ? wanted : "manual");
  setButtons(false);
  const state = await getJSON("api/fight").catch(() => null);
  if (state) {
    drawLog(state.log);
    drawFight(state.fight);
  }
})();
