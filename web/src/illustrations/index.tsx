/* Hand-drawn figures, referenced from markdown by id.

   Inline SVG rather than image files, because every figure has to work in both
   themes -- they use the same CSS variables the rest of the page does, so a
   figure is never a light-mode picture sitting in a dark-mode page.

   House style: one idea per figure, labels in the page's own font, the accent
   color for the thing being taught and hairlines for everything else.
*/

import { useEffect, useState, type ReactNode } from "react";

import { CodePopup } from "../components/CodePopup";

const label = { fontSize: 11, fill: "var(--fg-muted)", fontFamily: "inherit" } as const;
const faint = { fontSize: 10.5, fill: "var(--fg-faint)", fontFamily: "inherit" } as const;
const strong = { fontSize: 12, fill: "var(--fg)", fontWeight: 600, fontFamily: "inherit" } as const;
const mono = { fontSize: 10.5, fill: "var(--fg-muted)", fontFamily: "ui-monospace, monospace" } as const;

function Arrow({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
      <path d="M0 0 L7 3.5 L0 7 z" fill={color} />
    </marker>
  );
}

function Box({
  x, y, w = 110, h = 46, title, note, accent = false, dashed = false,
}: {
  x: number; y: number; w?: number; h?: number;
  title: string; note?: string; accent?: boolean; dashed?: boolean;
}) {
  return (
    <g>
      <rect
        x={x} y={y} width={w} height={h} rx="8"
        fill={accent ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--card)"}
        stroke={accent ? "var(--accent)" : "var(--hairline-strong)"}
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <text x={x + w / 2} y={note ? y + h / 2 - 2 : y + h / 2 + 4}
            textAnchor="middle" style={strong}>
        {title}
      </text>
      {note && (
        <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" style={faint}>
          {note}
        </text>
      )}
    </g>
  );
}

function Bar({ x, y, value, name, win = false, width = 150 }: {
  x: number; y: number; value: number; name: string; win?: boolean; width?: number;
}) {
  return (
    <g>
      <text x={x} y={y + 9} style={win ? strong : label}>{name}</text>
      <rect x={x + 70} y={y} width={width} height={10} rx="5" fill="var(--overlay)" stroke="var(--hairline)" />
      <rect x={x + 70} y={y} width={Math.max(2, width * value)} height={10} rx="5"
            fill={win ? "var(--accent)" : "var(--fg-faint)"} />
      <text x={x + 70 + width + 8} y={y + 9} style={mono}>{value.toFixed(2)}</text>
    </g>
  );
}

/* ── step 3 ─────────────────────────────────────────────────────────────── */

/* ── step 0 ─────────────────────────────────────────────────────────────── */

function ConversationToDecisions() {
  const rows = [
    { what: "LATENCY", chat: "seconds are fine", decide: "milliseconds, in the request path" },
    { what: "STRUCTURE", chat: "a paragraph for a person", decide: "a value code acts on" },
    { what: "PREDICTABILITY", chat: "no stated confidence", decide: "a confidence to check, a cost per event" },
  ];
  const examples = ["route a ticket", "flag a transaction", "hold a request", "allow a tool call", "choose a move"];
  const chipW = (t: string) => t.length * 5.9 + 16;
  let cx = 20;
  const chips = examples.map((t) => { const x = cx; cx += chipW(t) + 8; return { t, x, w: chipW(t) }; });
  return (
    <svg viewBox="0 0 620 262" role="img"
         aria-label="Conversation: a person prompts a language model and reads a paragraph, and seconds are fine. Decision: an event goes to a model and code takes the action, so the answer must arrive in milliseconds, as a value with a confidence. Examples: route a ticket, flag a transaction, hold a request, allow a tool call, choose a move.">
      <defs><Arrow id="cd-a" color="var(--hairline-strong)" /><Arrow id="cd-b" color="var(--accent)" /></defs>

      {/* conversation */}
      <text x={20} y={24} style={strong}>Conversation</text>
      <text x={20} y={40} style={faint}>a person reads the answer</text>
      <Box x={20} y={54} w={78} h={36} title="person" />
      <line x1="98" y1="66" x2="146" y2="66" stroke="var(--hairline-strong)" markerEnd="url(#cd-a)" />
      <text x={104} y={60} style={faint}>prompt</text>
      <Box x={148} y={54} w={118} h={36} title="language model" />
      <line x1="146" y1="80" x2="100" y2="80" stroke="var(--hairline-strong)" markerEnd="url(#cd-a)" />
      <text x={102} y={102} style={faint}>paragraph</text>

      {/* the shift */}
      <line x1="282" y1="72" x2="334" y2="72" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#cd-b)" />
      <text x={308} y={62} textAnchor="middle" style={{ ...faint, fill: "var(--accent)" }}>next stage</text>

      {/* decision */}
      <text x={346} y={24} style={{ ...strong, fill: "var(--accent)" }}>Decision</text>
      <text x={346} y={40} style={faint}>code acts on the answer</text>
      <Box x={346} y={54} w={70} h={36} title="event" />
      <line x1="416" y1="72" x2="430" y2="72" stroke="var(--accent)" markerEnd="url(#cd-b)" />
      <Box x={432} y={54} w={80} h={36} title="model" accent />
      <line x1="512" y1="72" x2="526" y2="72" stroke="var(--accent)" markerEnd="url(#cd-b)" />
      <Box x={528} y={54} w={78} h={36} title="action" />

      {/* what changes */}
      <line x1="20" y1="118" x2="606" y2="118" stroke="var(--hairline)" />
      {rows.map((r, i) => {
        const y = 140 + i * 24;
        return (
          <g key={r.what}>
            <text x={20} y={y} style={label}>{r.chat}</text>
            <text x={330} y={y} textAnchor="end" style={{ ...faint, fontSize: 9, letterSpacing: 1.2 }}>{r.what}</text>
            <text x={346} y={y} style={{ ...label, fill: "var(--fg)" }}>{r.decide}</text>
          </g>
        );
      })}
      <line x1="20" y1="202" x2="606" y2="202" stroke="var(--hairline)" />

      {/* examples */}
      <text x={20} y={222} style={faint}>Decisions products already make</text>
      {chips.map((c) => (
        <g key={c.t}>
          <rect x={c.x} y={232} width={c.w} height={22} rx="11"
                fill="color-mix(in srgb, var(--accent) 10%, transparent)" stroke="var(--accent)" strokeOpacity="0.5" />
          <text x={c.x + c.w / 2} y={247} textAnchor="middle" style={{ ...label, fontSize: 10.5, fill: "var(--fg)" }}>{c.t}</text>
        </g>
      ))}
    </svg>
  );
}

function SystemComponents() {
  const parts = [
    { x: 78, title: "Deterministic code", note: "rules and thresholds", cost: "instant · free", accent: false },
    { x: 238, title: "Discriminative model", note: "bounded decisions", cost: "70–500 ms · fractions of a cent", accent: true },
    { x: 398, title: "Language model", note: "perception · generation", cost: "seconds · per token", accent: false },
  ];
  return (
    <svg viewBox="0 0 620 190" role="img"
         aria-label="A workflow orchestrates deterministic code, a discriminative model, and a language model, turning an event into an action.">
      <defs><Arrow id="sc-a" color="var(--hairline-strong)" /></defs>
      <text x={8} y={112} style={label}>event</text>
      <line x1="42" y1="108" x2="60" y2="108" stroke="var(--hairline-strong)" markerEnd="url(#sc-a)" />
      <rect x={62} y={20} width={498} height={158} rx="12" fill="none" stroke="var(--hairline-strong)" strokeDasharray="4 3" />
      <text x={78} y={44} style={strong}>Workflow</text>
      <text x={146} y={44} style={faint}>orchestration · parallel branches · shared state (ADK)</text>
      {parts.map((p) => (
        <g key={p.title}>
          <Box x={p.x} y={68} w={146} h={62} title={p.title} note={p.note} accent={p.accent} />
          <text x={p.x + 73} y={156} textAnchor="middle" style={p.accent ? { ...faint, fill: "var(--accent)" } : faint}>{p.cost}</text>
        </g>
      ))}
      <line x1="560" y1="108" x2="578" y2="108" stroke="var(--hairline-strong)" markerEnd="url(#sc-a)" />
      <text x={582} y={112} style={label}>action</text>
    </svg>
  );
}

/* ── step 1 ─────────────────────────────────────────────────────────────── */

function ServingDataflow() {
  return (
    <svg viewBox="0 0 640 262" role="img"
         aria-label="The workshop code calls the TypeSafe SDK. Jev is reached over HTTPS. DiffusionGemma is reached through a gcloud IAP tunnel and Identity-Aware Proxy to a Compute Engine VM running djev-run and vLLM on a GPU.">
      <defs><Arrow id="sd-a" color="var(--hairline-strong)" /><Arrow id="sd-b" color="var(--accent)" /></defs>

      <rect x={10} y={14} width={186} height={236} rx="12" fill="none" stroke="var(--hairline-strong)" strokeDasharray="4 3" />
      <text x={24} y={36} style={strong}>Your machine</text>
      <text x={24} y={50} style={faint}>laptop or Cloud Shell</text>
      <Box x={24} y={62} w={158} h={44} title="Arena app · workflow" note="builds the request" />
      <line x1="103" y1="106" x2="103" y2="122" stroke="var(--hairline-strong)" markerEnd="url(#sd-a)" />
      <Box x={24} y={124} w={158} h={44} title="TypeSafe SDK" note="POST /v1/systemone" accent />
      <line x1="103" y1="168" x2="103" y2="186" stroke="var(--accent)" markerEnd="url(#sd-b)" />
      <Box x={24} y={188} w={158} h={44} title="gcloud IAP tunnel" note="localhost:8096" />

      {/* Jev */}
      <line x1="182" y1="140" x2="248" y2="62" stroke="var(--hairline-strong)" markerEnd="url(#sd-a)" />
      <text x={226} y={112} style={faint}>HTTPS</text>
      <Box x={250} y={30} w={170} h={50} title="Jev" note="api.typesafe.ai · API key" dashed />
      <text x={430} y={52} style={faint}>hosted by TypeSafe AI</text>

      {/* DiffusionGemma */}
      <line x1="182" y1="210" x2="222" y2="210" stroke="var(--accent)" markerEnd="url(#sd-b)" />
      <Box x={224} y={186} w={140} h={48} title="Identity-Aware Proxy" note="checks your identity" />
      <line x1="364" y1="210" x2="386" y2="210" stroke="var(--accent)" markerEnd="url(#sd-b)" />
      <rect x={388} y={106} width={242} height={144} rx="12" fill="none" stroke="var(--hairline-strong)" strokeDasharray="4 3" />
      <text x={400} y={126} style={strong}>Compute Engine VM</text>
      <text x={400} y={140} style={faint}>your project · port 8080 via IAP only</text>
      <Box x={398} y={152} w={112} h={40} title="djev-run" note=":8080 · Jev API" />
      <line x1="454" y1="192" x2="454" y2="200" stroke="var(--hairline-strong)" />
      <Box x={398} y={200} w={112} h={40} title="vLLM" note="DiffusionGemma" accent />
      <line x1="510" y1="220" x2="522" y2="220" stroke="var(--hairline-strong)" markerEnd="url(#sd-a)" />
      <Box x={524} y={186} w={94} h={54} title="GPU" note="24 GB memory" />
    </svg>
  );
}

function ServingStack() {
  const layers = [
    { name: "DiffusionGemma", detail: "26B-A4B · NVFP4 weights, 17.5 GB", accent: true },
    { name: "djev-run", detail: "Jev-compatible API · POST /v1/systemone" },
    { name: "vLLM 0.29", detail: "diffusion model support · Marlin FP4 kernel" },
    { name: "PyTorch 2.13", detail: "CUDA 13.0 · Python 3.12" },
    { name: "Container", detail: "Docker · NVIDIA Container Toolkit" },
    { name: "Ubuntu 24.04", detail: "Deep Learning VM image · NVIDIA driver 580" },
  ];
  return (
    <svg viewBox="0 0 610 300" role="img"
         aria-label="The stack on the VM, top to bottom: DiffusionGemma weights, djev-run, vLLM, PyTorch and CUDA, a Docker container, and Ubuntu with the NVIDIA driver, on a g2-standard-4 Compute Engine VM with a GPU attached.">
      <defs><Arrow id="ss-a" color="var(--hairline-strong)" /></defs>
      <rect x={10} y={10} width={590} height={280} rx="12" fill="none" stroke="var(--hairline-strong)" strokeDasharray="4 3" />
      <text x={24} y={32} style={strong}>Compute Engine VM</text>
      <text x={152} y={32} style={faint}>g2-standard-4 · 4 vCPUs · 16 GB memory · 100 GB disk</text>
      {layers.map((l, i) => {
        const y = 48 + i * 38;
        return (
          <g key={l.name}>
            <rect x={24} y={y} width={390} height={32} rx="6"
                  fill={l.accent ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--card)"}
                  stroke={l.accent ? "var(--accent)" : "var(--hairline-strong)"} />
            <text x={36} y={y + 20} style={strong}>{l.name}</text>
            <text x={148} y={y + 20} style={faint}>{l.detail}</text>
          </g>
        );
      })}
      <text x={434} y={60} style={faint}>downloaded from</text>
      <text x={434} y={74} style={faint}>Hugging Face on first boot</text>
      <line x1="432" y1="66" x2="416" y2="64" stroke="var(--hairline-strong)" markerEnd="url(#ss-a)" />
      <rect x={434} y={128} width={152} height={104} rx="10"
            fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke="var(--accent)" />
      <text x={510} y={170} textAnchor="middle" style={strong}>GPU</text>
      <text x={510} y={186} textAnchor="middle" style={faint}>24 GB memory</text>
      <text x={510} y={200} textAnchor="middle" style={faint}>attached to the VM</text>
      <line x1="434" y1="180" x2="416" y2="180" stroke="var(--accent)" strokeDasharray="3 3" />
      <text x={434} y={252} style={faint}>passed into the container</text>
      <text x={434} y={266} style={faint}>with --gpus all</text>
    </svg>
  );
}

/* ── step 5 ─────────────────────────────────────────────────────────────── */

function ModelModeStructure() {
  const col = (x: number, w: number, h: number, title: string, note: string, accent = false) => (
    <g>
      <rect x={x} y={12} width={w} height={h} rx="12"
            fill={accent ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "none"}
            stroke={accent ? "var(--accent)" : "var(--hairline-strong)"} strokeDasharray="4 3" />
      <text x={x + 12} y={32} style={strong}>{title}</text>
      <text x={x + 12} y={46} style={faint}>{note}</text>
    </g>
  );
  const arrow = (x1: number, y1: number, x2: number, y2: number, word: string, accent = false) => (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent ? "var(--accent)" : "var(--hairline-strong)"}
            markerEnd={`url(#mm-${accent ? "b" : "a"})`} />
      <text x={(x1 + x2) / 2} y={Math.min(y1, y2) - 5} textAnchor="middle" style={faint}>{word}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 680 290" role="img"
         aria-label="The arena app. The game from step 3: main.py, the server that loads mode plugins; engine.py, the rules and damage; sigil.py, the spell cards; and static/app.js, the page. Step 5 adds the model mode: mode_model.py, which asks the model every tick; reflex.py, the questions and choose(); and static/modes/model.js, the answer cards on the page. mode_model.py calls the model through the TypeSafe SDK, on Jev or DiffusionGemma.">
      <defs><Arrow id="mm-a" color="var(--hairline-strong)" /><Arrow id="mm-b" color="var(--accent)" /></defs>

      {col(10, 196, 268, "The game", "step 3, unchanged")}
      <Box x={22} y={58} w={172} h={44} title="main.py" note="server · loads mode plugins" />
      <Box x={22} y={112} w={172} h={44} title="engine.py" note="rules, moves, damage" />
      <Box x={22} y={166} w={172} h={44} title="sigil.py" note="the spell cards" />
      <Box x={22} y={220} w={172} h={44} title="static/app.js" note="the page · loads modes/*.js" />

      {col(252, 196, 268, "The model mode", "added in step 5", true)}
      <Box x={264} y={58} w={172} h={44} title="mode_model.py" note="asks the model every tick" accent />
      <Box x={264} y={112} w={172} h={44} title="reflex.py" note="the questions and choose()" accent />
      <Box x={264} y={220} w={172} h={44} title="static/modes/model.js" note="the answer cards" accent />

      {col(494, 176, 268, "The model", "outside the app")}
      <Box x={506} y={58} w={152} h={44} title="TypeSafe SDK" note="POST /v1/systemone" />
      <Box x={506} y={130} w={152} h={52} title="Jev" note="or DiffusionGemma" dashed />

      {arrow(194, 80, 262, 80, "loads")}
      {arrow(262, 134, 196, 134, "reads rules")}
      {arrow(194, 242, 262, 242, "loads")}
      {arrow(436, 80, 504, 80, "calls", true)}
      <line x1="582" y1="102" x2="582" y2="128" stroke="var(--accent)" markerEnd="url(#mm-b)" />
      <line x1="350" y1="102" x2="350" y2="110" stroke="var(--hairline-strong)" markerEnd="url(#mm-a)" />
    </svg>
  );
}

const FULL_REQUEST = `POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer $TYPESAFE_API_KEY
Content-Type: application/json

${JSON.stringify({
  state: {
    opponent: "a nine-foot ogre with a spiked club, thick hide, and a short temper",
    telegraph: "The ogre staggers, off balance, its guard wide open.",
  },
  model: "jev-latest",
  questions: {
    response: {
      type: "choice",
      instructions: "The opponent has just done this. What is the right response?",
      criteria: {
        block_high: "Raise the shield against a high swing.",
        block_low: "Drop the shield against a swing at the legs.",
        dodge: "Step aside from a charge or a thrown object.",
        strike: "Attack now, while the opponent is exposed.",
        wait: "Hold and watch, against a feint.",
      },
    },
    exposed: { type: "noul", instructions: "Is the opponent exposed to a counter-attack right now?" },
  },
}, null, 2)}`;

const FULL_RESPONSE = JSON.stringify({
  model: "jev-1.13.0",
  answers: {
    response: {
      type: "choice",
      choice: "strike",
      confidence: 0.96,
      probabilities: { block_high: 0.01, block_low: 0.01, dodge: 0.01, strike: 0.97, wait: 0.0 },
    },
    exposed: { type: "noul", noul: 0.97 },
  },
  usage: { input_tokens: 190, output_tokens: 0 },
}, null, 2);

function RequestPath() {
  const [open, setOpen] = useState<"" | "request" | "response">("");
  const card = (x: number, y: number, h: number, title: string, lines: string[]) => (
    <g>
      <rect x={x} y={y} width={236} height={h} rx="8" fill="var(--overlay)" stroke="var(--hairline)" />
      <text x={x + 12} y={y + 18} style={{ ...faint, fill: "var(--accent)" }}>{title}</text>
      {lines.map((line, i) => (
        <text key={line} x={x + 12} y={y + 36 + i * 15} style={mono}>{line}</text>
      ))}
    </g>
  );
  return (
    <svg viewBox="0 0 640 270" role="img"
         aria-label="Your code sends a request through the TypeSafe SDK: POST /v1/systemone with the state, a choice question and a noul question. It goes either to Jev at api.typesafe.ai with an API key, or to djev-run on port 8080, which exposes the same Jev API on top of vLLM running DiffusionGemma. The response names the model, gives the choice with its confidence and the noul as a probability, and reports the tokens.">
      <defs><Arrow id="rp-a" color="var(--accent)" /></defs>

      <Box x={14} y={106} w={150} h={58} title="Your code" note="TypeSafe SDK" accent />

      <g role="button" tabIndex={0} aria-label="Show the full HTTP request"
         onClick={() => setOpen("request")}
         onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setOpen("request"); }}
         style={{ cursor: "pointer" }}>
        {card(176, 10, 100, "request", [
          "POST /v1/systemone",
          "state: opponent, telegraph",
          "response: choice of 5",
          "exposed: noul",
        ])}
        <text x={400} y={28} textAnchor="end" style={{ ...faint, fill: "var(--accent)" }}>show in full ⤢</text>
      </g>
      <line x1="164" y1="122" x2="420" y2="122" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#rp-a)" />
      <line x1="422" y1="148" x2="168" y2="148" stroke="var(--accent)" strokeWidth="1.5" markerEnd="url(#rp-a)" />
      <g role="button" tabIndex={0} aria-label="Show the full HTTP response"
         onClick={() => setOpen("response")}
         onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setOpen("response"); }}
         style={{ cursor: "pointer" }}>
        {card(176, 160, 100, "response", [
          "model: jev-1.13.0",
          "response: strike · conf 0.96",
          "exposed: 0.97",
          "usage: 190 input · 0 output",
        ])}
        <text x={400} y={178} textAnchor="end" style={{ ...faint, fill: "var(--accent)" }}>show in full ⤢</text>
      </g>

      {/* either backend, same API */}
      <line x1="428" y1="58" x2="428" y2="178" stroke="var(--hairline-strong)" />
      <line x1="428" y1="58" x2="444" y2="58" stroke="var(--hairline-strong)" markerEnd="url(#rp-a)" />
      <line x1="428" y1="178" x2="454" y2="178" stroke="var(--hairline-strong)" markerEnd="url(#rp-a)" />

      <Box x={446} y={32} w={180} h={52} title="Jev" note="api.typesafe.ai · API key" dashed />
      <text x={536} y={112} textAnchor="middle" style={faint}>or, the same API</text>

      <rect x={446} y={124} width={180} height={128} rx="10" fill="none" stroke="var(--hairline-strong)" strokeDasharray="4 3" />
      <text x={458} y={142} style={faint}>DiffusionGemma on a VM</text>
      <Box x={456} y={156} w={160} h={42} title="djev-run" note=":8080 · Jev API" accent />
      <Box x={456} y={204} w={160} h={40} title="vLLM" note="DiffusionGemma" />
      {open === "request" && <CodePopup title="HTTP request" code={FULL_REQUEST} onClose={() => setOpen("")} />}
      {open === "response" && (
        <CodePopup title="HTTP response" code={FULL_RESPONSE} format="json" onClose={() => setOpen("")} />
      )}
    </svg>
  );
}

function ParallelBranch() {
  const ticks = Array.from({ length: 15 }, (_, i) => i);
  const READY = 10;                     // the tick that first sees the spell
  const tx = (i: number) => 20 + i * 38;
  return (
    <svg viewBox="0 0 620 150" role="img"
         aria-label="Parallel branch with shared state: the tick loop keeps running every half second, and each tick reads the spell slot. Meanwhile the spell branch runs read_rune, spellwright on Gemini for a few seconds, and spell_ready, which writes the spell to state. The first tick after that casts it.">
      <defs><Arrow id="lr-a" color="var(--hairline-strong)" /><Arrow id="lr-b" color="var(--accent)" /></defs>

      <text x={20} y={20} style={{ ...strong, fill: "var(--accent)" }}>Parallel branch with shared state</text>
      <text x={20} y={42} style={faint}>tick loop · every 0.5 s</text>
      {ticks.map((i) => {
        const cast = i === READY;
        return (
          <g key={i}>
            <rect x={tx(i)} y={50} width={30} height={22} rx="5"
                  fill={cast ? "var(--accent)" : "var(--card)"}
                  stroke={cast ? "var(--accent)" : "var(--hairline-strong)"} />
            <text x={tx(i) + 15} y={65} textAnchor="middle"
                  style={{ ...mono, fontSize: 9, fill: cast ? "var(--bg, #fff)" : "var(--fg-faint)" }}>
              {cast ? "cast" : "tick"}
            </text>
          </g>
        );
      })}
      <text x={20} y={88} style={faint}>each tick reads state["spell"]: not ready</text>

      <text x={20} y={110} style={faint}>spell branch</text>
      <Box x={92} y={98} w={78} h={32} title="read_rune" />
      <line x1="170" y1="114" x2="184" y2="114" stroke="var(--hairline-strong)" markerEnd="url(#lr-a)" />
      <Box x={186} y={98} w={176} h={40} title="spellwright" note="Gemini · a few seconds" />
      <line x1="362" y1="114" x2="376" y2="114" stroke="var(--hairline-strong)" markerEnd="url(#lr-a)" />
      <Box x={378} y={98} w={96} h={32} title="spell_ready" accent />
      <line x1={tx(READY) + 15} y1="98" x2={tx(READY) + 15} y2="76" stroke="var(--accent)" markerEnd="url(#lr-b)" />
      <text x={484} y={118} style={{ ...faint, fill: "var(--accent)" }}>writes state["spell"]</text>
    </svg>
  );
}

/* ── step 3 ─────────────────────────────────────────────────────────────── */

function AppStructure() {
  const page = ["index.html", "app.js", "style.css"];
  const server = [
    ["Arena", "the fight in memory"],
    ["routes", "telegraph · respond · cast"],
    ["plugin loader", "every mode_*.py it finds"],
  ];
  return (
    <svg viewBox="0 0 620 300" role="img"
         aria-label="The arena app in step 3. The browser loads the page from static: index.html, app.js and style.css. It calls main.py over HTTP. main.py holds the fight in memory, serves the game's routes, and loads plugins. It uses engine.py for the rules and sigil.py for the spell cards. Steps 5 and 6 add plugin files on the server and the page.">
      <defs><Arrow id="as-a" color="var(--hairline-strong)" /><Arrow id="as-b" color="var(--accent)" /></defs>

      {/* the page */}
      <rect x={10} y={14} width={170} height={176} rx="12" fill="none" stroke="var(--hairline-strong)" strokeDasharray="4 3" />
      <text x={24} y={36} style={strong}>Your browser</text>
      <text x={24} y={51} style={faint}>static/ · the page</text>
      {page.map((name, i) => (
        <g key={name}>
          <rect x={24} y={64 + i * 38} width={142} height={30} rx="6" fill="var(--card)" stroke="var(--hairline-strong)" />
          <text x={36} y={83 + i * 38} style={mono}>{name}</text>
        </g>
      ))}
      <text x={96} y={83 + 38} style={faint}>You fight</text>

      {/* HTTP */}
      <line x1="180" y1="100" x2="226" y2="100" stroke="var(--accent)" markerEnd="url(#as-b)" />
      <line x1="226" y1="112" x2="180" y2="112" stroke="var(--accent)" markerEnd="url(#as-b)" />
      <text x={203} y={92} textAnchor="middle" style={{ ...faint, fill: "var(--accent)" }}>HTTP</text>
      <text x={203} y={128} textAnchor="middle" style={faint}>/api/…</text>

      {/* the server */}
      <rect x={228} y={14} width={214} height={176} rx="12"
            fill="color-mix(in srgb, var(--accent) 8%, transparent)" stroke="var(--accent)" />
      <text x={242} y={36} style={strong}>main.py</text>
      <text x={300} y={36} style={faint}>the server, port 8090</text>
      {server.map(([name, note], i) => (
        <g key={name}>
          <rect x={242} y={52 + i * 44} width={186} height={36} rx="6" fill="var(--card)" stroke="var(--hairline-strong)" />
          <text x={254} y={67 + i * 44} style={strong}>{name}</text>
          <text x={254} y={81 + i * 44} style={faint}>{note}</text>
        </g>
      ))}

      {/* the game */}
      <line x1="442" y1="70" x2="470" y2="58" stroke="var(--hairline-strong)" markerEnd="url(#as-a)" />
      <line x1="442" y1="112" x2="470" y2="126" stroke="var(--hairline-strong)" markerEnd="url(#as-a)" />
      <Box x={472} y={30} w={136} h={52} title="engine.py" note="rules · moves · the fight" />
      <Box x={472} y={100} w={136} h={52} title="sigil.py" note="spell cards: draw, judge" />

      {/* added later */}
      <line x1="10" y1="214" x2="610" y2="214" stroke="var(--hairline)" />
      <text x={10} y={234} style={faint}>ADDED LATER, AS NEW FILES</text>
      <line x1="335" y1="178" x2="335" y2="244" stroke="var(--hairline-strong)" strokeDasharray="3 3" />
      <rect x={172} y={246} width={200} height={42} rx="8" fill="none" stroke="var(--hairline-strong)" strokeDasharray="4 3" />
      <text x={184} y={263} style={strong}>step 5 · model fights</text>
      <text x={184} y={278} style={mono}>mode_model.py + model.js</text>
      <rect x={386} y={246} width={222} height={42} rx="8" fill="none" stroke="var(--hairline-strong)" strokeDasharray="4 3" />
      <text x={398} y={263} style={strong}>step 6 · workflow fights</text>
      <text x={398} y={278} style={mono}>mode_workflow.py + workflow.js</text>
    </svg>
  );
}

function MovesAndResponses() {
  const rows = [
    { tell: "raises the club high", reply: "block high", result: "counter: ogre −3" },
    { tell: "swings low at your knees", reply: "block low", result: "counter: ogre −3" },
    { tell: "lowers its shoulder and charges", reply: "dodge", result: "counter: ogre −3" },
    { tell: "staggers, guard open", reply: "strike", result: "opening: ogre −8" },
    { tell: "circles you", reply: "wait", result: "nothing happens" },
  ];
  const head = { ...faint, fontSize: 9, letterSpacing: 1.2 };
  return (
    <svg viewBox="0 0 620 370" role="img"
         aria-label="Each telegraph has one right response: raises the club high, block high; swings low, block low; charges, dodge; staggers with guard open, strike; circles, wait. You have two seconds. To cast a spell, pick the spell card's color and shapes in order, for example frost, crescent, ring, bar, then press CAST; it does 45 damage, 67 on an opening. A wrong call costs 12 or 24 HP, running out of time counts as waiting, and a wrong spell fizzles.">
      <defs><Arrow id="mr-a" color="var(--hairline-strong)" /><Arrow id="mr-b" color="var(--accent)" /></defs>

      <text x={20} y={22} style={head}>THE OGRE'S TELEGRAPH</text>
      <text x={298} y={22} style={head}>YOUR RESPONSE</text>
      <text x={452} y={22} style={head}>RIGHT CALL</text>

      {/* the clock */}
      <rect x={298} y={30} width={110} height={6} rx="3" fill="var(--overlay)" stroke="var(--hairline)" />
      <rect x={298} y={30} width={74} height={6} rx="3" fill="var(--accent)" />
      <text x={414} y={37} style={{ ...mono, fill: "var(--accent)" }}>2 s</text>

      {rows.map((r, i) => {
        const y = 50 + i * 36;
        return (
          <g key={r.reply}>
            <rect x={20} y={y} width={236} height={26} rx="6" fill="var(--card)" stroke="var(--hairline-strong)" />
            <text x={32} y={y + 17} style={{ ...label, fontStyle: "italic", fill: "var(--fg)" }}>{r.tell}</text>
            <line x1="256" y1={y + 13} x2="294" y2={y + 13} stroke="var(--hairline-strong)" markerEnd="url(#mr-a)" />
            <rect x={298} y={y} width={110} height={26} rx="13"
                  fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke="var(--accent)" />
            <text x={353} y={y + 17} textAnchor="middle" style={strong}>{r.reply}</text>
            <line x1="408" y1={y + 13} x2="446" y2={y + 13} stroke="var(--accent)" markerEnd="url(#mr-b)" />
            <text x={452} y={y + 17} style={label}>{r.result}</text>
          </g>
        );
      })}

      {/* the spell: read the spell card, type it, release it */}
      <line x1="20" y1="232" x2="600" y2="232" stroke="var(--hairline)" />
      <text x={20} y={252} style={head}>THE SPELL CARD, IN THE CORNER</text>
      <text x={268} y={252} style={head}>PICK COLOR, SHAPES, THEN CAST</text>
      <g>
        <rect x={20} y={262} width={96} height={30} rx="5" fill="var(--card)" stroke="#6cc8ff" strokeWidth="2" />
        <path d="M44 270 a8 8 0 1 0 0 14 a6 6 0 1 1 0 -14 z" fill="#6cc8ff" />
        <circle cx={68} cy={277} r={6.5} fill="none" stroke="#6cc8ff" strokeWidth="2.5" />
        <rect x={84} y={275} width={20} height={4} rx="1" fill="#6cc8ff" />
      </g>
      <text x={20} y={308} style={faint}>color, then shapes left to right</text>
      <line x1="124" y1="277" x2="264" y2="277" stroke="var(--hairline-strong)" markerEnd="url(#mr-a)" />
      <g>
        <rect x={268} y={264} width={44} height={26} rx="5" fill="#6cc8ff" />
        <text x={290} y={281} textAnchor="middle" style={{ ...mono, fontSize: 9, fill: "#0b0b1a" }}>frost</text>
        <rect x={316} y={264} width={26} height={26} rx="5" fill="var(--card)" stroke="#6cc8ff" />
        <path d="M331.6 271.1 a7 7 0 1 0 0 11.8 a5.6 5.6 0 0 1 0 -11.8 z" fill="#6cc8ff" />
        <rect x={346} y={264} width={26} height={26} rx="5" fill="var(--card)" stroke="#6cc8ff" />
        <circle cx={359} cy={277} r={5.8} fill="none" stroke="#6cc8ff" strokeWidth="2.6" />
        <rect x={376} y={264} width={26} height={26} rx="5" fill="var(--card)" stroke="#6cc8ff" />
        <rect x={381.5} y={275.4} width={15} height={3.2} fill="#6cc8ff" />
        <rect x={406} y={264} width={32} height={26} rx="5" fill="var(--accent)" />
        <text x={422} y={281} textAnchor="middle" style={{ ...mono, fontSize: 8.5, fill: "#fff" }}>CAST</text>
      </g>
      <line x1="438" y1="277" x2="448" y2="277" stroke="var(--accent)" markerEnd="url(#mr-b)" />
      <text x={452} y={274} style={{ ...strong, fill: "var(--accent)" }}>spell: ogre −45</text>
      <text x={452} y={289} style={faint}>−67 on an opening</text>

      <line x1="20" y1="320" x2="600" y2="320" stroke="var(--hairline)" />
      <text x={20} y={340} style={label}>
        <tspan style={{ ...strong, fill: "var(--red, #f43f5e)" }}>Wrong call:</tspan>
        <tspan> you take 12 HP from a light hit, 24 from a heavy one. Out of time counts as wait.</tspan>
      </text>
      <text x={20} y={358} style={label}>
        <tspan style={{ ...strong, fill: "var(--red, #f43f5e)" }}>Wrong spell:</tspan>
        <tspan> it fizzles, and the ogre's move still lands if you did not answer it.</tspan>
      </text>
    </svg>
  );
}

function TwoSystems() {
  const tokens = ["Yes,", "the", "ogre", "is"];
  return (
    <svg viewBox="0 0 610 228" role="img"
         aria-label="System Two: a language model writes one token at a time and takes seconds. System One: a discriminative model answers every question in one pass in milliseconds.">
      <defs><Arrow id="ts-a" color="var(--hairline-strong)" /><Arrow id="ts-b" color="var(--accent)" /></defs>

      {/* System Two */}
      <text x={20} y={26} style={strong}>System Two</text>
      <text x={20} y={42} style={faint}>language model · reasons step by step</text>
      <Box x={20} y={64} w={66} h={40} title="input" />
      <line x1="86" y1="84" x2="104" y2="84" stroke="var(--hairline-strong)" markerEnd="url(#ts-a)" />
      {tokens.map((t, i) => (
        <g key={t}>
          <rect x={106 + i * 42} y={73} width={32} height={22} rx="5" fill="var(--card)" stroke="var(--hairline-strong)" />
          <text x={122 + i * 42} y={88} textAnchor="middle" style={mono}>{t}</text>
          {i < tokens.length - 1 && (
            <line x1={138 + i * 42} y1="84" x2={146 + i * 42} y2="84" stroke="var(--hairline-strong)" markerEnd="url(#ts-a)" />
          )}
        </g>
      ))}
      <text x={272} y={88} style={mono}>…</text>
      <text x={20} y={122} style={faint}>one token at a time, each built on the last</text>
      <text x={20} y={152} style={label}>Output</text>
      <text x={72} y={152} style={strong}>text</text>
      <text x={20} y={168} style={faint}>code has to parse it to find the decision</text>
      <text x={20} y={194} style={faint}>time to answer</text>
      <rect x={20} y={200} width={210} height={8} rx="4" fill="var(--fg-faint)" />
      <text x={238} y={208} style={mono}>seconds</text>

      <line x1="305" y1="14" x2="305" y2="214" stroke="var(--hairline)" />

      {/* System One */}
      <text x={322} y={26} style={{ ...strong, fill: "var(--accent)" }}>System One</text>
      <text x={322} y={42} style={faint}>discriminative model · answers in one pass</text>
      <Box x={322} y={64} w={66} h={40} title="input" />
      <line x1="388" y1="84" x2="404" y2="84" stroke="var(--accent)" markerEnd="url(#ts-b)" />
      <Box x={406} y={58} w={84} h={52} title="one pass" note="all questions" accent />
      <line x1="490" y1="84" x2="504" y2="84" stroke="var(--accent)" markerEnd="url(#ts-b)" />
      <text x={508} y={79} style={strong}>yes</text>
      <rect x={532} y={70} width={40} height={10} rx="5" fill="var(--overlay)" stroke="var(--hairline)" />
      <rect x={532} y={70} width={39} height={10} rx="5" fill="var(--accent)" />
      <text x={577} y={79} style={mono}>0.97</text>
      <text x={508} y={97} style={label}>no</text>
      <rect x={532} y={88} width={40} height={10} rx="5" fill="var(--overlay)" stroke="var(--hairline)" />
      <rect x={532} y={88} width={2} height={10} rx="1" fill="var(--fg-faint)" />
      <text x={577} y={97} style={mono}>0.03</text>
      <text x={322} y={122} style={faint}>every question answered at once</text>
      <text x={322} y={152} style={label}>Output</text>
      <text x={374} y={152} style={{ ...strong, fill: "var(--accent)" }}>probabilities</text>
      <text x={322} y={168} style={faint}>code reads the number and applies a threshold</text>
      <text x={322} y={194} style={faint}>time to answer</text>
      <rect x={322} y={200} width={22} height={8} rx="4" fill="var(--accent)" />
      <text x={352} y={208} style={mono}>70–500 ms</text>
    </svg>
  );
}

function TwoPaths() {
  return (
    <svg viewBox="0 0 560 210" role="img" aria-label="The same question, is the ogre about to strike, sent to a language model, which writes a paragraph over seconds, and to a discriminative model, which returns about to strike: 0.97 in milliseconds">
      <defs><Arrow id="tp-a" color="var(--hairline-strong)" /><Arrow id="tp-b" color="var(--accent)" /></defs>
      <Box x={16} y={80} w={120} h={50} title="About to strike?" note="+ what the ogre did" />

      <text x={200} y={40} style={faint}>language model</text>
      <line x1="136" y1="98" x2="190" y2="66" stroke="var(--hairline-strong)" markerEnd="url(#tp-a)" />
      <rect x={196} y={46} width={200} height={62} rx="8" fill="var(--card)" stroke="var(--hairline-strong)" />
      <text x={206} y={64} style={mono}>“Yes, the ogre appears to be</text>
      <text x={206} y={78} style={mono}>raising its club high, which</text>
      <text x={206} y={92} style={mono}>suggests an attack is…”</text>
      <line x1="396" y1="77" x2="440" y2="77" stroke="var(--hairline-strong)" markerEnd="url(#tp-a)" />
      <text x={446} y={70} style={faint}>seconds:</text>
      <text x={446} y={84} style={faint}>the club lands</text>

      <text x={200} y={140} style={{ ...faint, fill: "var(--accent)" }}>discriminative model</text>
      <line x1="136" y1="112" x2="190" y2="148" stroke="var(--accent)" markerEnd="url(#tp-b)" />
      <rect x={196} y={146} width={200} height={40} rx="8"
            fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke="var(--accent)" />
      <text x={296} y={171} textAnchor="middle" style={{ ...mono, fontSize: 13, fill: "var(--fg)" }}>about to strike: 0.97</text>
      <line x1="396" y1="166" x2="440" y2="166" stroke="var(--accent)" markerEnd="url(#tp-b)" />
      <text x={446} y={160} style={{ ...faint, fill: "var(--accent)" }}>milliseconds:</text>
      <text x={446} y={174} style={faint}>read the number</text>
    </svg>
  );
}

function OneRequest() {
  return (
    <svg viewBox="0 0 560 200" role="img" aria-label="One call sends the state and three questions. The answers come back together: response block_high with confidence 0.87, danger 1.8 of 2, exposed 0.08.">
      <defs><Arrow id="or-a" color="var(--accent)" /></defs>
      <rect x={16} y={16} width={230} height={168} rx="10" fill="var(--overlay)" stroke="var(--hairline)" />
      <text x={28} y={36} style={faint}>request</text>
      <Box x={28} y={46} w={206} h={40} title="state" note="the opponent, what it just did" />
      <Box x={28} y={96} w={206} h={24} title="response · choice" />
      <Box x={28} y={126} w={206} h={24} title="danger · score" />
      <Box x={28} y={156} w={206} h={22} title="exposed · noul" />

      <line x1="246" y1="100" x2="300" y2="100" stroke="var(--accent)" strokeWidth="2" markerEnd="url(#or-a)" />
      <text x={273} y={90} textAnchor="middle" style={{ ...faint, fill: "var(--accent)" }}>one call</text>

      <rect x={310} y={16} width={234} height={168} rx="10"
            fill="color-mix(in srgb, var(--accent) 8%, transparent)" stroke="var(--accent)" />
      <text x={322} y={36} style={faint}>answers, in parallel</text>
      {[
        ["response", "block_high  0.91", "confidence 0.87"],
        ["danger", "1.8 of 2", "confidence 0.72"],
        ["exposed", "0.08", "probability of yes"],
      ].map(([name, value, detail], i) => (
        <g key={name}>
          <text x={322} y={62 + i * 34} style={label}>{name}</text>
          <text x={392} y={62 + i * 34} style={{ ...mono, fontSize: 12, fill: "var(--fg)" }}>{value}</text>
          <text x={392} y={76 + i * 34} style={faint}>{detail}</text>
        </g>
      ))}
      <text x={322} y={172} style={faint}>jev-1.13.0 · 121 input tokens · 0 output</text>
    </svg>
  );
}

function PrimitiveCard({ title, kind, lines, note, height, children }: {
  title: string; kind: string; lines: string[]; note: string; height: number; children: ReactNode;
}) {
  return (
    <svg viewBox={`0 0 560 ${height}`} role="img" aria-label={`${title}: ${kind}. ${lines.join(", ")}. ${note}.`}>
      <rect x={12} y={10} width={536} height={height - 20} rx="10" fill="var(--card)" stroke="var(--hairline-strong)" />
      <text x={28} y={36} style={strong}>{title}</text>
      <text x={28} y={52} style={faint}>{kind}</text>
      {lines.map((line, i) => (
        <text key={line} x={28} y={78 + i * 16} style={mono}>{line}</text>
      ))}
      <text x={28} y={height - 24} style={faint}>{note}</text>
      {children}
    </svg>
  );
}

function PrimitiveChoice() {
  return (
    <PrimitiveCard title="Choice" kind="one of a set, no order" height={136}
                   lines={["choice: block_high", "confidence: 0.76"]} note="up to 255 options">
      <Bar x={230} y={28} width={200} value={0.82} name="block high" win />
      <Bar x={230} y={50} width={200} value={0.11} name="dodge" />
      <Bar x={230} y={72} width={200} value={0.05} name="block low" />
      <Bar x={230} y={94} width={200} value={0.02} name="strike" />
    </PrimitiveCard>
  );
}

function PrimitiveScore() {
  return (
    <PrimitiveCard title="Score" kind="a position on ordered levels" height={136}
                   lines={["score: 1.35 of 2", "confidence: 0.33"]} note="2 to 10 levels">
      <Bar x={230} y={38} width={200} value={0.05} name="0 none" />
      <Bar x={230} y={60} width={200} value={0.55} name="1 light" win />
      <Bar x={230} y={82} width={200} value={0.40} name="2 heavy" />
    </PrimitiveCard>
  );
}

function PrimitiveNoul() {
  const x = 230, w = 290;
  return (
    <PrimitiveCard title="Noul" kind="probability a statement is true" height={136}
                   lines={["exposed: 0.97"]} note="the number is the confidence">
      <rect x={x} y={46} width={w} height={14} rx="7" fill="var(--overlay)" stroke="var(--hairline)" />
      <rect x={x} y={46} width={w * 0.97} height={14} rx="7" fill="var(--accent)" />
      {[[0, "0 · no"], [0.5, "0.5 · either"], [1, "1 · yes"]].map(([at, text]) => (
        <g key={String(text)}>
          <line x1={x + w * Number(at)} y1="64" x2={x + w * Number(at)} y2="70" stroke="var(--hairline-strong)" />
          <text x={x + w * Number(at)} y={84}
                textAnchor={at === 0 ? "start" : at === 1 ? "end" : "middle"} style={faint}>{text}</text>
        </g>
      ))}
    </PrimitiveCard>
  );
}

function FocusedQuestions() {
  const head = { ...faint, fontSize: 9, letterSpacing: 1.2 };
  const rows = [
    { q: "What is the right response?", a: "block_high · 0.91" },
    { q: "Is the opponent exposed?", a: "0.08 · likely no" },
    { q: "How hard will this hit?", a: "heavy · 1.9 of 2" },
  ];
  return (
    <svg viewBox="0 0 600 236" role="img"
         aria-label="A vague question, what is the situation, gets a spread-out answer with low confidence. Focused questions get clear answers: block high 0.91, exposed 0.08, heavy 1.9 of 2. Your code combines them into block high.">
      <defs><Arrow id="fq-a" color="var(--hairline-strong)" /><Arrow id="fq-b" color="var(--accent)" /></defs>

      {/* vague */}
      <text x={20} y={26} style={head}>VAGUE</text>
      <Box x={20} y={36} w={190} h={32} title="What is the situation?" />
      <line x1="115" y1="68" x2="115" y2="82" stroke="var(--hairline-strong)" markerEnd="url(#fq-a)" />
      <Bar x={20} y={90} width={62} value={0.31} name="calm" />
      <Bar x={20} y={110} width={62} value={0.27} name="attack" />
      <Bar x={20} y={130} width={62} value={0.24} name="opening" />
      <Bar x={20} y={150} width={62} value={0.18} name="feint" />
      <text x={20} y={186} style={mono}>confidence 0.12</text>
      <text x={20} y={202} style={faint}>plausible, but not usable</text>

      <line x1="228" y1="20" x2="228" y2="216" stroke="var(--hairline)" />

      {/* focused */}
      <text x={246} y={26} style={{ ...head, fill: "var(--accent)" }}>FOCUSED</text>
      {rows.map((r, i) => {
        const y = 36 + i * 44;
        return (
          <g key={r.q}>
            <Box x={246} y={y} w={190} h={32} title={r.q} />
            <line x1="436" y1={y + 16} x2="450" y2={y + 16} stroke="var(--accent)" markerEnd="url(#fq-b)" />
            <text x={454} y={y + 20} style={{ ...mono, fill: "var(--fg)" }}>{r.a}</text>
          </g>
        );
      })}
      <path d="M572 52 L582 52 L582 140 L572 140" fill="none" stroke="var(--accent)" />
      <line x1="582" y1="96" x2="582" y2="176" stroke="var(--accent)" markerEnd="url(#fq-b)" />
      <Box x={440} y={178} w={148} h={42} title="block high" note="your code combines" accent />
    </svg>
  );
}

function NextWordVsBlank() {
  const head = { ...faint, fontSize: 9, letterSpacing: 1.2 };
  const row = (y: number, accent: boolean) => ({
    box: accent ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "var(--card)",
    line: accent ? "var(--accent)" : "var(--hairline-strong)",
    arrow: accent ? "url(#nb-b)" : "url(#nb-a)",
    y,
  });
  const lm = row(34, false);
  const dm = row(150, true);
  const cols = [14, 206, 350, 484];
  return (
    <svg viewBox="0 0 600 262" role="img"
         aria-label="The same scoring step used two ways. A language model reads 'The ogre raises its club', scores every token for the next word, turns the logits into probabilities, picks 'high', adds it and repeats. A discriminative model reads the answer form 'response: blank', scores every token at the blank, keeps the allowed labels, turns them into probabilities that add up to 1, and stops.">
      <defs><Arrow id="nb-a" color="var(--hairline-strong)" /><Arrow id="nb-b" color="var(--accent)" /></defs>
      {/* column heads */}
      <text x={cols[0]} y={20} style={head}>THE TEXT SO FAR</text>
      <text x={cols[1]} y={20} style={head}>LOGITS</text>
      <text x={cols[2]} y={20} style={head}>SOFTMAX</text>
      <text x={cols[3]} y={20} style={head}>THEN</text>

      {/* language model: next word */}
      <text x={cols[0]} y={lm.y + 6} style={faint}>language model · next word</text>
      <rect x={cols[0]} y={lm.y + 14} width={176} height={64} rx="8" fill={lm.box} stroke={lm.line} />
      <text x={cols[0] + 10} y={lm.y + 40} style={mono}>The ogre raises its</text>
      <text x={cols[0] + 10} y={lm.y + 56} style={mono}>club ▢</text>
      <line x1={190} y1={lm.y + 46} x2={204} y2={lm.y + 46} stroke={lm.line} markerEnd={lm.arrow} />
      <rect x={cols[1]} y={lm.y + 14} width={130} height={64} rx="8" fill={lm.box} stroke={lm.line} />
      {[["high", "3.1"], ["up", "2.4"], ["hard", "1.0"]].map(([w, v], i) => (
        <g key={w}>
          <text x={cols[1] + 10} y={lm.y + 32 + i * 15} style={mono}>{w}</text>
          <text x={cols[1] + 118} y={lm.y + 32 + i * 15} textAnchor="end" style={mono}>{v}</text>
        </g>
      ))}
      <line x1={336} y1={lm.y + 46} x2={348} y2={lm.y + 46} stroke={lm.line} markerEnd={lm.arrow} />
      <rect x={cols[2]} y={lm.y + 14} width={122} height={64} rx="8" fill={lm.box} stroke={lm.line} />
      {[["high", "0.58"], ["up", "0.29"], ["hard", "0.07"]].map(([w, v], i) => (
        <g key={w}>
          <text x={cols[2] + 10} y={lm.y + 32 + i * 15} style={mono}>{w}</text>
          <text x={cols[2] + 110} y={lm.y + 32 + i * 15} textAnchor="end" style={mono}>{v}</text>
        </g>
      ))}
      <line x1={472} y1={lm.y + 46} x2={482} y2={lm.y + 46} stroke={lm.line} markerEnd={lm.arrow} />
      <text x={cols[3] + 2} y={lm.y + 36} style={strong}>picks "high"</text>
      <text x={cols[3] + 2} y={lm.y + 52} style={faint}>adds it, repeats</text>
      <path d={`M ${cols[3] + 40} ${lm.y + 62} C ${cols[3] + 40} ${lm.y + 100}, 100 ${lm.y + 100}, 100 ${lm.y + 82}`}
            fill="none" stroke="var(--hairline-strong)" strokeDasharray="3 3" markerEnd="url(#nb-a)" />
      <text x={290} y={lm.y + 102} textAnchor="middle" style={faint}>one token at a time</text>

      {/* discriminative read: a blank */}
      <text x={cols[0]} y={dm.y + 6} style={{ ...faint, fill: "var(--accent)" }}>discriminative model · a blank</text>
      <rect x={cols[0]} y={dm.y + 14} width={176} height={78} rx="8" fill={dm.box} stroke={dm.line} />
      <text x={cols[0] + 10} y={dm.y + 34} style={faint}>state + labels a … e</text>
      <text x={cols[0] + 10} y={dm.y + 58} style={{ ...mono, fontSize: 12, fill: "var(--fg)" }}>response: ▢</text>
      <text x={cols[0] + 10} y={dm.y + 80} style={faint}>the form, one blank each</text>
      <line x1={190} y1={dm.y + 52} x2={204} y2={dm.y + 52} stroke={dm.line} markerEnd={dm.arrow} />
      <rect x={cols[1]} y={dm.y + 14} width={130} height={78} rx="8" fill={dm.box} stroke={dm.line} />
      {[["a", "4.2", true], ["b", "1.1", true], ["c", "0.9", true], ['"yes"', "1.3", false]].map(([w, v, keep], i) => {
        const y = dm.y + 32 + i * 15;
        const st = keep ? mono : { ...mono, fill: "var(--fg-faint)" };
        return (
          <g key={String(w)}>
            <text x={cols[1] + 10} y={y} style={st}>{w}</text>
            <text x={cols[1] + 118} y={y} textAnchor="end" style={st}>{v}</text>
            {!keep && <line x1={cols[1] + 8} y1={y - 4} x2={cols[1] + 120} y2={y - 4} stroke="var(--fg-faint)" />}
          </g>
        );
      })}
      <line x1={336} y1={dm.y + 52} x2={348} y2={dm.y + 52} stroke={dm.line} markerEnd={dm.arrow} />
      <rect x={cols[2]} y={dm.y + 14} width={122} height={78} rx="8" fill={dm.box} stroke={dm.line} />
      <text x={cols[2] + 10} y={dm.y + 30} style={faint}>allowed labels only</text>
      {[["a", "0.89"], ["b", "0.04"], ["c", "0.03"]].map(([w, v], i) => (
        <g key={w}>
          <text x={cols[2] + 10} y={dm.y + 48 + i * 15} style={mono}>{w}</text>
          <text x={cols[2] + 110} y={dm.y + 48 + i * 15} textAnchor="end" style={mono}>{v}</text>
        </g>
      ))}
      <line x1={472} y1={dm.y + 52} x2={482} y2={dm.y + 52} stroke={dm.line} markerEnd={dm.arrow} />
      <text x={cols[3] + 2} y={dm.y + 44} style={{ ...strong, fill: "var(--accent)" }}>stops</text>
      <text x={cols[3] + 2} y={dm.y + 60} style={faint}>reports block_high</text>
      <text x={cols[3] + 2} y={dm.y + 74} style={faint}>at 0.89</text>
    </svg>
  );
}

function HowProbabilities() {
  const head = { ...faint, fontSize: 9, letterSpacing: 1.2 };
  const labels = [["a", "block_high"], ["b", "block_low"], ["c", "dodge"], ["d", "strike"], ["e", "wait"]];
  const scores: [string, string, boolean][] = [
    ["a", "4.2", true], ["b", "1.1", true], ["c", "0.9", true], ["d", "0.2", true], ["e", "0.4", true],
    ['"yes"', "1.3", false], ['"the"', "0.1", false],
  ];
  const probs: [string, number][] = [["block_high", 0.89], ["block_low", 0.04], ["dodge", 0.03], ["wait", 0.02], ["strike", 0.02]];
  return (
    <svg viewBox="0 0 600 262" role="img"
         aria-label="How DiffusionGemma gets a probability. The prompt lists the state and the allowed answers as labels a to e. In one pass the model scores every token at the answer blank. The server keeps only the label scores and normalises them: block high 0.89, block low 0.04, dodge 0.03, wait 0.02, strike 0.02. If unsure, it reads again from another random start and averages.">
      <defs><Arrow id="hp-a" color="var(--hairline-strong)" /><Arrow id="hp-b" color="var(--accent)" /></defs>

      {/* 1 · the prompt */}
      <text x={14} y={22} style={head}>THE PROMPT</text>
      <rect x={14} y={30} width={172} height={190} rx="10" fill="var(--card)" stroke="var(--hairline-strong)" />
      <text x={26} y={50} style={faint}>state</text>
      <text x={26} y={66} style={mono}>The ogre raises its</text>
      <text x={26} y={80} style={mono}>club high.</text>
      <text x={26} y={104} style={faint}>question: right response?</text>
      {labels.map(([k, v], i) => (
        <text key={k} x={26} y={124 + i * 16} style={mono}>{k}  {v}</text>
      ))}
      <text x={26} y={212} style={faint}>answer: response = ▢</text>

      <line x1="186" y1="125" x2="206" y2="125" stroke="var(--hairline-strong)" markerEnd="url(#hp-a)" />

      {/* 2 · one pass: scores at the blank */}
      <text x={208} y={22} style={{ ...head, fill: "var(--accent)" }}>ONE PASS</text>
      <rect x={208} y={30} width={176} height={190} rx="10"
            fill="color-mix(in srgb, var(--accent) 8%, transparent)" stroke="var(--accent)" />
      <text x={220} y={50} style={faint}>logit for every token</text>
      <text x={220} y={64} style={faint}>at the blank</text>
      {scores.map(([tok, sc, kept], i) => {
        const y = 86 + i * 17;
        const st = kept ? { ...mono, fill: "var(--fg)" } : { ...mono, fill: "var(--fg-faint)" };
        return (
          <g key={tok}>
            <text x={220} y={y} style={st}>{tok}</text>
            <text x={318} y={y} style={st} textAnchor="end">{sc}</text>
            {!kept && <line x1="218" y1={y - 4} x2="322" y2={y - 4} stroke="var(--fg-faint)" />}
            {kept && <text x={330} y={y} style={{ ...faint, fill: "var(--accent)" }}>keep</text>}
          </g>
        );
      })}
      <text x={220} y={212} style={faint}>… and every other token</text>

      <line x1="384" y1="125" x2="404" y2="125" stroke="var(--accent)" markerEnd="url(#hp-b)" />

      {/* 3 · normalise the kept scores */}
      <text x={406} y={22} style={head}>SOFTMAX</text>
      <rect x={406} y={30} width={182} height={190} rx="10" fill="var(--card)" stroke="var(--hairline-strong)" />
      <text x={418} y={50} style={faint}>labels only, adding up to 1</text>
      {probs.map(([n, v], i) => (
        <Bar key={n} x={418} y={68 + i * 22} width={60} value={v} name={n} win={i === 0} />
      ))}
      <text x={418} y={196} style={mono}>answer: block_high</text>
      <text x={418} y={212} style={faint}>probability 0.89</text>

      <text x={14} y={248} style={faint}>If the read looks unsure, the server reads again from another random start and averages the reads.</text>
    </svg>
  );
}

function ConfidenceFromSpread() {
  const head = { ...faint, fontSize: 9, letterSpacing: 1.2 };
  const panels = [
    { title: "sure", probs: [0.91, 0.06, 0.03], conf: "0.87", note: "act on it", accent: true },
    { title: "leaning", probs: [0.60, 0.30, 0.10], conf: "0.40", note: "right on the arena's 0.40 line", accent: false },
    { title: "even", probs: [0.34, 0.33, 0.33], conf: "0.01", note: "fall back to something safe", accent: false },
  ];
  const names = ["block_high", "dodge", "block_low"];
  const steps = ["logits", "softmax", "probabilities", "confidence"];
  return (
    <svg viewBox="0 0 600 286" role="img"
         aria-label="Confidence is computed from the probabilities after the softmax. Sure: block high 0.91, confidence 0.87, act on it. Leaning: 0.60, confidence 0.40, the arena's line. Even: 0.34, confidence 0.01, fall back to something safe.">
      <defs><Arrow id="cs-a" color="var(--hairline-strong)" /></defs>
      {steps.map((st, i) => {
        const x = 70 + i * 128;
        const last = i === steps.length - 1;
        return (
          <g key={st}>
            <rect x={x} y={12} width={104} height={26} rx="13"
                  fill={last ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--card)"}
                  stroke={last ? "var(--accent)" : "var(--hairline-strong)"} />
            <text x={x + 52} y={29} textAnchor="middle" style={last ? { ...strong, fill: "var(--accent)" } : label}>{st}</text>
            {!last && <line x1={x + 104} y1="25" x2={x + 124} y2="25" stroke="var(--hairline-strong)" markerEnd="url(#cs-a)" />}
          </g>
        );
      })}

      {panels.map((pn, i) => {
        const x = 14 + i * 196;
        return (
          <g key={pn.title}>
            <rect x={x} y={56} width={182} height={218} rx="10" fill="var(--card)"
                  stroke={pn.accent ? "var(--accent)" : "var(--hairline-strong)"} />
            <text x={x + 12} y={78} style={head}>{pn.title.toUpperCase()}</text>
            {pn.probs.map((v, k) => (
              <Bar key={k} x={x + 12} y={90 + k * 22} width={56} value={v} name={names[k]} win={k === 0} />
            ))}
            <text x={x + 12} y={176} style={faint}>(3 × largest − 1) / 2</text>
            <text x={x + 12} y={194} style={mono}>(3 × {pn.probs[0].toFixed(2)} − 1) / 2</text>
            <text x={x + 12} y={222} style={{ ...strong, fill: pn.accent ? "var(--accent)" : "var(--fg)" }}>confidence {pn.conf}</text>
            <text x={x + 12} y={256} style={faint}>{pn.note}</text>
          </g>
        );
      })}
    </svg>
  );
}

function ThresholdBands() {
  const head = { ...faint, fontSize: 9, letterSpacing: 1.2 };
  const x0 = 40, w = 520;
  const at = (v: number) => x0 + w * v;
  const bands = [
    { from: 0, to: 0.4, name: "low", does: "fall back", colour: "var(--red, #f43f5e)" },
    { from: 0.4, to: 0.8, name: "medium", does: "act with a check", colour: "var(--amber, #f59e0b)" },
    { from: 0.8, to: 1, name: "high", does: "act on its own", colour: "var(--accent)" },
  ];
  const answers = [
    { conf: 0.25, text: "block_high · 0.25", result: "falls back: dodge" },
    { conf: 0.55, text: "block_high · 0.55", result: "asks for a check" },
    { conf: 0.87, text: "block_high · 0.87", result: "blocks high" },
  ];
  return (
    <svg viewBox="0 0 600 214" role="img"
         aria-label="A confidence axis from 0 to 1. Below 0.40 is low, fall back. From 0.40 to 0.80 is medium, act with a check. From 0.80 up is high, act on its own. Block high at 0.25 falls back to dodge, at 0.55 asks for a check, at 0.87 blocks high.">
      <text x={x0} y={20} style={head}>CONFIDENCE</text>
      {bands.map((b) => (
        <g key={b.name}>
          <rect x={at(b.from)} y={34} width={at(b.to) - at(b.from)} height={30}
                fill={`color-mix(in srgb, ${b.colour} 16%, transparent)`} stroke={b.colour} strokeOpacity="0.6" />
          <text x={(at(b.from) + at(b.to)) / 2} y={48} textAnchor="middle" style={{ ...strong, fontSize: 11 }}>{b.name}</text>
          <text x={(at(b.from) + at(b.to)) / 2} y={60} textAnchor="middle" style={faint}>{b.does}</text>
        </g>
      ))}
      {[0, 0.4, 0.8, 1].map((v) => (
        <g key={v}>
          <line x1={at(v)} y1="64" x2={at(v)} y2="72" stroke="var(--hairline-strong)" />
          <text x={at(v)} y={84} textAnchor="middle" style={mono}>{v.toFixed(2)}</text>
        </g>
      ))}
      {answers.map((a, i) => {
        const y = 118 + i * 30;
        return (
          <g key={a.text}>
            <line x1={at(a.conf)} y1="72" x2={at(a.conf)} y2={y - 8} stroke="var(--hairline-strong)" strokeDasharray="2 3" />
            <circle cx={at(a.conf)} cy={y - 4} r="4" fill="var(--fg)" />
            <text x={at(a.conf) + (a.conf > 0.7 ? -10 : 10)} y={y} textAnchor={a.conf > 0.7 ? "end" : "start"}
                  style={{ ...mono, fill: "var(--fg)" }}>{a.text}</text>
            <text x={at(a.conf) + (a.conf > 0.7 ? -10 : 10)} y={y + 13} textAnchor={a.conf > 0.7 ? "end" : "start"}
                  style={faint}>{a.result}</text>
          </g>
        );
      })}
    </svg>
  );
}

function ChooseFlow() {
  const diamond = (x: number, y: number, lines: string[]) => (
    <g>
      <rect x={x} y={y} width={176} height={56} rx="10" fill="var(--card)" stroke="var(--hairline-strong)" />
      {lines.map((l, i) => (
        <text key={l} x={x + 88} y={y + 24 + i * 15} textAnchor="middle" style={mono}>{l}</text>
      ))}
    </g>
  );
  const outcome = (x: number, y: number, title: string, note: string, accent = false) => (
    <Box x={x} y={y} w={120} h={42} title={title} note={note} accent={accent} />
  );
  return (
    <svg viewBox="0 0 600 224" role="img"
         aria-label="choose() takes the model's answers. First check: confidence below 0.40 and danger at 1.5 or more? Yes, dodge. No, second check: spell ready, the action is strike, and exposed at 0.60 or more? Yes, cast. No, do the model's choice.">
      <defs><Arrow id="cf-a" color="var(--hairline-strong)" /><Arrow id="cf-b" color="var(--accent)" /></defs>
      <Box x={10} y={36} w={110} h={56} title="the answers" note="from the model" />
      <line x1="120" y1="64" x2="146" y2="64" stroke="var(--hairline-strong)" markerEnd="url(#cf-a)" />
      {diamond(148, 36, ["confidence < 0.40", "and danger ≥ 1.5 ?"])}
      <line x1="236" y1="92" x2="236" y2="124" stroke="var(--hairline-strong)" markerEnd="url(#cf-a)" />
      <text x={244} y={112} style={faint}>no</text>
      <line x1="324" y1="64" x2="462" y2="64" stroke="var(--accent)" markerEnd="url(#cf-b)" />
      <text x={392} y={56} textAnchor="middle" style={{ ...faint, fill: "var(--accent)" }}>yes</text>
      {outcome(464, 43, "dodge", "play it safe", true)}
      {diamond(148, 126, ["spell ready, strike,", "and exposed ≥ 0.60 ?"])}
      <line x1="324" y1="154" x2="462" y2="138" stroke="var(--accent)" markerEnd="url(#cf-b)" />
      <text x={392} y={138} textAnchor="middle" style={{ ...faint, fill: "var(--accent)" }}>yes</text>
      {outcome(464, 116, "cast", "spend the spell", true)}
      <line x1="236" y1="182" x2="236" y2="196" stroke="var(--hairline-strong)" />
      <line x1="236" y1="196" x2="462" y2="196" stroke="var(--hairline-strong)" markerEnd="url(#cf-a)" />
      <text x={250} y={210} style={faint}>no</text>
      {outcome(464, 176, "the model's choice", "e.g. block_high")}
    </svg>
  );
}

function ProbabilityBars() {
  return (
    <svg viewBox="0 0 560 170" role="img" aria-label="Two choice answers with the same top option and different confidence">
      <rect x={12} y={12} width={260} height={146} rx="10" fill="var(--card)" stroke="var(--accent)" />
      <text x={24} y={34} style={strong}>sure</text>
      <Bar x={24} y={52} width={110} value={0.91} name="block high" win />
      <Bar x={24} y={72} width={110} value={0.05} name="dodge" />
      <Bar x={24} y={92} width={110} value={0.03} name="block low" />
      <Bar x={24} y={112} width={110} value={0.01} name="strike" />
      <text x={24} y={146} style={mono}>confidence 0.88 → shield up</text>

      <rect x={288} y={12} width={260} height={146} rx="10" fill="var(--card)" stroke="var(--hairline-strong)" />
      <text x={300} y={34} style={strong}>not sure</text>
      <Bar x={300} y={52} width={110} value={0.44} name="block high" win />
      <Bar x={300} y={72} width={110} value={0.41} name="dodge" />
      <Bar x={300} y={92} width={110} value={0.10} name="block low" />
      <Bar x={300} y={112} width={110} value={0.05} name="strike" />
      <text x={300} y={146} style={mono}>confidence 0.25 → fall back: dodge</text>
    </svg>
  );
}

/* ── step 2 ─────────────────────────────────────────────────────────────── */

function ArenaFlow() {
  return (
    <svg viewBox="0 0 560 150" role="img" aria-label="A telegraph goes to the Discriminative model, three answers come back, the rules resolve the tick">
      <defs><Arrow id="af-a" color="var(--hairline-strong)" /><Arrow id="af-b" color="var(--accent)" /></defs>
      <Box x={12} y={50} w={100} h={50} title="telegraph" note="what the ogre did" />
      <line x1="112" y1="75" x2="144" y2="75" stroke="var(--hairline-strong)" markerEnd="url(#af-a)" />
      <Box x={146} y={40} w={130} h={70} title="Discriminative model" note="3 questions, 1 call" accent />
      <line x1="276" y1="75" x2="304" y2="75" stroke="var(--accent)" markerEnd="url(#af-b)" />
      <rect x={306} y={30} width={116} height={90} rx="8" fill="var(--card)" stroke="var(--hairline-strong)" />
      <text x={316} y={52} style={mono}>response 0.91</text>
      <text x={316} y={78} style={mono}>exposed  0.08</text>
      <text x={316} y={104} style={mono}>danger   1.8</text>
      <line x1="422" y1="75" x2="458" y2="75" stroke="var(--hairline-strong)" markerEnd="url(#af-a)" />
      <Box x={460} y={40} w={88} h={70} title="choose()" note="then resolve()" />
    </svg>
  );
}

function CostShape() {
  return (
    <svg viewBox="0 0 560 190" role="img" aria-label="Cost grows with output for a language model and only with input for the Discriminative model">
      <defs><Arrow id="cs-a" color="var(--hairline-strong)" /></defs>
      <line x1="50" y1="150" x2="530" y2="150" stroke="var(--hairline-strong)" markerEnd="url(#cs-a)" />
      <line x1="50" y1="150" x2="50" y2="20" stroke="var(--hairline-strong)" markerEnd="url(#cs-a)" />
      <text x={520} y={168} textAnchor="end" style={faint}>length of the answer</text>
      <text x={58} y={30} style={faint}>cost per call</text>
      <path d="M50 140 C 200 130, 350 70, 520 40" fill="none" stroke="var(--fg-faint)" strokeWidth="2" />
      <text x={330} y={60} style={label}>language model: input + output tokens</text>
      <path d="M50 142 L 520 142" fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      <text x={300} y={134} style={{ ...label, fill: "var(--accent)" }}>The Discriminative model: input tokens only, output is free</text>
    </svg>
  );
}

/* ── step 5 ─────────────────────────────────────────────────────────────── */

function ArenaGraph() {
  const fast = "var(--accent)";
  const line = "var(--hairline-strong)";
  return (
    <svg viewBox="0 0 600 250" role="img"
         aria-label="The bell, enter, splits the workflow in two. The slow branch calls Gemini to read the spell card and write the spell into shared state, spell ready. The fast branch calls the Discriminative model every tick and reads that shared state. The branches never call each other; they only share state.">
      <defs><Arrow id="ag-a" color={line} /><Arrow id="ag-b" color={fast} /></defs>

      <Box x={10} y={103} w={84} h={44} title="enter" note="the bell" />
      <line x1="94" y1="116" x2="168" y2="48" stroke={line} markerEnd="url(#ag-a)" />
      <line x1="94" y1="134" x2="168" y2="202" stroke={fast} markerEnd="url(#ag-b)" />
      <text x={106} y={128} style={faint}>split</text>

      {/* slow branch */}
      <text x={170} y={14} style={faint}>slow branch · seconds</text>
      <Box x={170} y={22} w={280} h={52} title="Gemini" note="reads the spell card and sings a spell" dashed />

      {/* shared state */}
      <line x1="310" y1="74" x2="310" y2="98" stroke={line} strokeDasharray="3 3" markerEnd="url(#ag-a)" />
      <text x={318} y={90} style={faint}>writes</text>
      <rect x={220} y={100} width={180} height={50} rx="8" fill="var(--overlay)" stroke={line} strokeDasharray="5 3" />
      <text x={310} y={121} textAnchor="middle" style={strong}>shared state</text>
      <text x={310} y={138} textAnchor="middle" style={mono}>spell ready?</text>
      <line x1="310" y1="150" x2="310" y2="174" stroke={fast} strokeDasharray="3 3" markerEnd="url(#ag-b)" />
      <text x={318} y={166} style={{ ...faint, fill: fast }}>reads, every tick</text>

      {/* fast branch */}
      <text x={170} y={244} style={{ ...faint, fill: fast }}>fast branch · about 100 ms a tick</text>
      <Box x={170} y={176} w={280} h={52} title="Discriminative model" note="one decision every tick" accent />
      <path d="M450 190 C 500 190, 500 214, 452 214" fill="none" stroke={fast} markerEnd="url(#ag-b)" />
      <text x={498} y={206} style={{ ...faint, fill: fast }}>loop</text>
    </svg>
  );
}

/* Step 6c: the arena app with the workflow mode added, and the ADK workflow
   it starts in its own process. Step 5's files are muted; step 6's are lit. */
function WorkflowModeStructure() {
  const line = "var(--hairline-strong)";
  const fast = "var(--accent)";
  const group = (x: number, y: number, w: number, h: number, title: string, note: string, lit = false, muted = false) => (
    <g opacity={muted ? 0.55 : 1}>
      <rect x={x} y={y} width={w} height={h} rx="12"
            fill={lit ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "none"}
            stroke={lit ? fast : line} strokeDasharray="4 3" />
      <text x={x + 12} y={y + 20} style={strong}>{title}</text>
      <text x={x + 12} y={y + 34} style={faint}>{note}</text>
    </g>
  );
  const arrow = (d: string, word: string, wx: number, wy: number, color = line, id = "wm-a", dashed = false) => (
    <g>
      <path d={d} fill="none" stroke={color} strokeDasharray={dashed ? "4 3" : undefined} markerEnd={`url(#${id})`} />
      <text x={wx} y={wy} textAnchor="middle" style={faint}>{word}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 760 340" role="img"
         aria-label="The arena app with the workflow mode. The game from step 3: main.py, engine.py, sigil.py and static/app.js. The model mode from step 5: mode_model.py, reflex.py and static/modes/model.js. Step 6 adds mode_workflow.py, which starts the ADK workflow in agents/arena/agent.py as its own process, and static/modes/workflow.js, which draws the workflow fight. The workflow plays over HTTP, posting moves and spells back to the app, uses reflex.py's questions and choose(), and calls the Discriminative model through the TypeSafe SDK and Gemini on Vertex AI.">
      <defs><Arrow id="wm-a" color={line} /><Arrow id="wm-b" color={fast} /></defs>

      {group(10, 10, 190, 320, "The game", "step 3")}
      <Box x={22} y={58} w={166} h={42} title="main.py" note="server · loads mode plugins" />
      <Box x={22} y={110} w={166} h={42} title="engine.py" note="rules, moves, damage" />
      <Box x={22} y={162} w={166} h={42} title="sigil.py" note="the spell cards" />
      <Box x={22} y={268} w={166} h={42} title="static/app.js" note="the page · loads modes/*.js" />

      {group(250, 10, 196, 150, "The model mode", "step 5", false, true)}
      <g opacity={0.55}>
        <Box x={262} y={50} w={172} h={30} title="mode_model.py" />
        <Box x={262} y={86} w={172} h={30} title="reflex.py" />
        <Box x={262} y={122} w={172} h={30} title="static/modes/model.js" />
      </g>

      {group(250, 172, 196, 158, "The workflow mode", "added in step 6", true)}
      <Box x={262} y={212} w={172} h={44} title="mode_workflow.py" note="starts the workflow, judges it" accent />
      <Box x={262} y={266} w={172} h={44} title="static/modes/workflow.js" note="draws the workflow fight" accent />

      {group(516, 10, 234, 186, "The ADK workflow", "its own process", true)}
      <rect x={528} y={50} width={210} height={134} rx="8"
            fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke={fast} />
      <text x={633} y={72} textAnchor="middle" style={strong}>agents/arena/agent.py</text>
      {["fast: tick, check_spell", "slow: read_rune, spellwright,", "spell_ready", "end: summarise, bard"].map((t, i) => (
        <text key={t} x={633} y={96 + i * 18} textAnchor="middle" style={mono}>{t}</text>
      ))}

      {group(516, 208, 234, 122, "The models", "outside the app")}
      <Box x={528} y={250} w={210} h={40} title="Discriminative model" note="TypeSafe SDK" />
      <Box x={528} y={296} w={210} h={28} title="Gemini · Vertex AI" />

      {arrow("M188 79 C 225 79, 225 234, 260 234", "loads", 225, 140)}
      {arrow("M188 289 L 260 289", "loads", 225, 283)}
      {arrow("M434 226 C 481 226, 481 120, 526 120", "starts", 481, 168, fast, "wm-b")}
      {arrow("M528 160 C 481 160, 481 250, 436 250", "", 0, 0, line, "wm-a", true)}
      <text x={481} y={272} textAnchor="middle" style={faint}>moves, spells</text>
      <text x={481} y={285} textAnchor="middle" style={faint}>over HTTP</text>
      {arrow("M528 68 C 481 68, 481 101, 436 101", "", 0, 0, line, "wm-a", true)}
      <text x={481} y={52} textAnchor="middle" style={faint}>questions,</text>
      <text x={481} y={64} textAnchor="middle" style={faint}>choose()</text>
      {arrow("M633 184 L 633 248", "", 0, 0, fast, "wm-b")}
      {arrow("M738 150 C 756 150, 756 310, 740 310", "", 0, 0, fast, "wm-b")}
    </svg>
  );
}

/* One event loop, one thread: a branch runs until it reaches an await, then
   the loop runs the other one. Solid is running, dashed is waiting. */
function EventLoop() {
  const fast = "var(--accent)";
  const run = (x1: number, x2: number, y: number, name: string, color: string) => (
    <g key={`${name}-${x1}`}>
      <rect x={x1} y={y - 13} width={x2 - x1} height={26} rx="5"
            fill={`color-mix(in srgb, ${color} 18%, transparent)`} stroke={color} />
      <text x={(x1 + x2) / 2} y={y + 4} textAnchor="middle" style={{ ...mono, fontSize: 10, fill: "var(--fg)" }}>{name}</text>
    </g>
  );
  const wait = (x1: number, x2: number, y: number, word: string, color: string) => (
    <g key={`w-${x1}-${y}`}>
      <line x1={x1 + 2} y1={y} x2={x2 - 4} y2={y} stroke={color} strokeDasharray="4 4" markerEnd="url(#el-a)" />
      {word && <text x={(x1 + x2) / 2} y={y - 8} textAnchor="middle" style={faint}>{word}</text>}
    </g>
  );
  const slow = "var(--fg-muted)";
  return (
    <svg viewBox="0 0 680 186" role="img"
         aria-label="One event loop in one thread. The fast branch runs tick, waits at an await for the model, runs tick and check_spell, and repeats. While it waits, the loop runs the slow branch: read_rune, then a long await for Gemini of several seconds, then spell_ready. Only one runs at a time, and each runs while the other is waiting.">
      <defs><Arrow id="el-a" color="var(--hairline-strong)" /></defs>
      <text x={10} y={20} style={strong}>One event loop, one thread</text>
      <text x={198} y={20} style={faint}>it switches branch at every await</text>

      <text x={10} y={130} style={{ ...label, fill: fast }}>fast branch</text>
      {run(110, 160, 126, "tick", fast)}
      {wait(160, 250, 126, "await model", fast)}
      {run(250, 290, 126, "tick", fast)}
      {run(290, 368, 126, "check_spell", fast)}
      {run(368, 408, 126, "tick", fast)}
      {wait(408, 478, 126, "await model", fast)}
      {run(478, 518, 126, "tick", fast)}
      {run(518, 596, 126, "check_spell", fast)}
      {wait(596, 664, 126, "…", fast)}

      <text x={10} y={70} style={label}>slow branch</text>
      {run(160, 244, 66, "read_rune", slow)}
      {wait(244, 590, 66, "await Gemini · seconds", slow)}
      {run(590, 670, 66, "spell_ready", slow)}

      <text x={10} y={174} style={faint}>Solid: the branch is running. Dashed: it waits at an await, and the loop runs the other branch.</text>
    </svg>
  );
}

/* One pass through tick(): read the slot, get the ogre's move, ask the model,
   apply the thresholds, let the arena resolve it, then route. */
function TickNode() {
  const fast = "var(--accent)";
  const line = "var(--hairline-strong)";
  const steps: [string, string, boolean][] = [
    ["state[\"spell\"]", "is a spell ready?", false],
    ["arena.telegraph", "the ogre's move", false],
    ["system_one", "the model answers", true],
    ["choose()", "thresholds → action", false],
    ["arena.respond", "resolves the blow", false],
  ];
  const routeLabel = (x: number, y: number, text: string, anchor: "start" | "middle" | "end" = "middle") => (
    <text x={x} y={y} textAnchor={anchor} style={{ ...mono, fontSize: 10.5, fill: fast }}>{text}</text>
  );
  return (
    <svg viewBox="0 0 680 262" role="img"
         aria-label="One pass through tick: read whether a spell is ready, get the ogre's move from the arena, ask the Discriminative model, apply the thresholds in choose(), and let the arena resolve the blow. Then a decision with three outcomes: route next to check_spell while the match goes on; route recast and next, to read_rune and check_spell, when a spell was just cast; route done to summarise when someone reaches 0 HP or tick 60.">
      <defs><Arrow id="tn-a" color={line} /><Arrow id="tn-b" color={fast} /></defs>
      <text x={10} y={18} style={faint}>one tick · system_one is awaited, so the slow branch keeps running</text>
      {steps.map(([title, note, accent], i) => (
        <g key={title}>
          <Box x={10 + i * 134} y={30} w={118} h={50} title={title} note={note} accent={accent} />
          {i < steps.length - 1 && (
            <line x1={128 + i * 134} y1="55" x2={142 + i * 134} y2="55" stroke={line} markerEnd="url(#tn-a)" />
          )}
        </g>
      ))}

      {/* the decision */}
      <path d="M605 80 V 110 H 372" fill="none" stroke={line} markerEnd="url(#tn-a)" />
      <polygon points="308,98 372,98 340,142" fill="var(--card)" stroke={fast} strokeWidth="1.5" />
      <text x={340} y={116} textAnchor="middle" style={{ ...strong, fontSize: 13 }}>?</text>
      <text x={300} y={112} textAnchor="end" style={faint}>match over? spell just cast?</text>

      {/* the three outcomes, each with the route tick returns */}
      <line x1="334" y1="142" x2="126" y2="198" stroke={fast} markerEnd="url(#tn-b)" />
      <line x1="340" y1="142" x2="340" y2="198" stroke={fast} markerEnd="url(#tn-b)" />
      <line x1="346" y1="142" x2="554" y2="198" stroke={line} markerEnd="url(#tn-a)" />
      {routeLabel(214, 164, 'route=["next"]', "end")}
      {routeLabel(333, 191, 'route=["recast", "next"]', "end")}
      {routeLabel(478, 160, 'route=["done"]', "start")}

      <Box x={22} y={200} w={200} h={50} title="check_spell" note="the match goes on" accent />
      <Box x={240} y={200} w={200} h={50} title="read_rune + check_spell" note="a spell was cast; keep fighting too" />
      <Box x={458} y={200} w={200} h={50} title="summarise" note="0 HP, or tick 60" />
    </svg>
  );
}

/* check_spell(): a look at the slot that never waits, then back to tick. */
function CheckSpellNode() {
  const fast = "var(--accent)";
  const line = "var(--hairline-strong)";
  return (
    <svg viewBox="0 0 680 178" role="img"
         aria-label="check_spell reads the spell slot in state. If a spell is there, it reports ready with the spell's name. If the slot is still empty, it reports not ready and how long Gemini has been working. Either way it routes again, back to tick, without waiting.">
      <defs><Arrow id="cs-a" color={line} /><Arrow id="cs-b" color={fast} /></defs>
      <Box x={10} y={62} w={130} h={50} title="check_spell" note={'reads state["spell"]'} accent />
      <line x1="140" y1="78" x2="196" y2="44" stroke={line} markerEnd="url(#cs-a)" />
      <line x1="140" y1="96" x2="196" y2="130" stroke={line} markerEnd="url(#cs-a)" />
      <text x={160} y={52} style={faint}>filled</text>
      <text x={160} y={132} style={faint}>empty</text>
      <Box x={198} y={18} w={220} h={50} title="report: ready" note="the spell's name" />
      <Box x={198} y={106} w={220} h={50} title="report: not ready" note="seconds Gemini has been working" />
      <line x1="418" y1="43" x2="470" y2="78" stroke={fast} markerEnd="url(#cs-b)" />
      <line x1="418" y1="131" x2="470" y2="96" stroke={fast} markerEnd="url(#cs-b)" />
      <Box x={472} y={62} w={92} h={50} title="again" note="always" accent />
      <line x1="564" y1="87" x2="586" y2="87" stroke={fast} markerEnd="url(#cs-b)" />
      <Box x={588} y={62} w={82} h={50} title="tick" note="next exchange" accent />
      <text x={10} y={170} style={faint}>It never waits for Gemini. The page shows the report; tick casts once the slot is filled.</text>
    </svg>
  );
}

/* read_rune(): the spell card, exactly as the screen shows it, becomes
   Gemini's user turn. */
function ReadRuneNode() {
  const line = "var(--hairline-strong)";
  return (
    <svg viewBox="0 0 680 128" role="img"
         aria-label="read_rune takes the spell card on the arena's screen, grabs it as a PNG with rune_png, and wraps it with a line of text in a Content, which becomes the spellwright's user turn.">
      <defs><Arrow id="rr-a" color={line} /></defs>
      <rect x={14} y={22} width={120} height={70} rx="8" fill="var(--card)" stroke="#a86ef0" strokeWidth="3" />
      <circle cx={44} cy={57} r={9} fill="var(--fg-muted)" />
      <rect x={62} y={54} width={22} height={6} rx="2" fill="var(--fg-muted)" />
      <polygon points="113,46 124,57 113,68 102,57" fill="var(--fg-muted)" />
      <text x={74} y={110} textAnchor="middle" style={faint}>the spell card on screen</text>
      <line x1="134" y1="57" x2="170" y2="57" stroke={line} markerEnd="url(#rr-a)" />
      <Box x={172} y={32} w={130} h={50} title="rune_png()" note="exactly what is shown" />
      <line x1="302" y1="57" x2="338" y2="57" stroke={line} markerEnd="url(#rr-a)" />
      <rect x={340} y={22} width={176} height={70} rx="8" fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke="var(--accent)" />
      <text x={352} y={42} style={strong}>Content (role "user")</text>
      <text x={352} y={60} style={mono}>text: "Sing the spell…"</text>
      <text x={352} y={76} style={mono}>image/png: the card</text>
      <line x1="516" y1="57" x2="552" y2="57" stroke={line} markerEnd="url(#rr-a)" />
      <Box x={554} y={32} w={112} h={50} title="spellwright" note="its user turn" dashed />
      <text x={428} y={110} textAnchor="middle" style={faint}>also notes in state when reading began</text>
    </svg>
  );
}

/* spellwright: Gemini reads the image and answers in a fixed shape. */
function SpellwrightNode() {
  const line = "var(--hairline-strong)";
  return (
    <svg viewBox="0 0 680 150" role="img"
         aria-label="The spellwright is an LlmAgent on gemini-flash-latest. Its instruction says the colour is the element and the three shapes are read left to right. Its output_schema is Sung: an element, three glyphs, and an incantation.">
      <defs><Arrow id="sw-a" color={line} /></defs>
      <Box x={10} y={50} w={110} h={50} title="the card" note="image/png" />
      <line x1="120" y1="75" x2="156" y2="75" stroke={line} markerEnd="url(#sw-a)" />
      <rect x={158} y={14} width={240} height={122} rx="10" fill="var(--card)" stroke={line} strokeDasharray="4 3" />
      <text x={172} y={36} style={strong}>spellwright · LlmAgent</text>
      <text x={172} y={52} style={faint}>gemini-flash-latest</text>
      <text x={172} y={76} style={label}>colour of the border → element</text>
      <text x={172} y={94} style={label}>three shapes, read left to right</text>
      <text x={172} y={112} style={label}>a short incantation</text>
      <line x1="398" y1="75" x2="434" y2="75" stroke={line} markerEnd="url(#sw-a)" />
      <rect x={436} y={14} width={234} height={122} rx="10"
            fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke="var(--accent)" />
      <text x={450} y={36} style={strong}>Sung</text>
      <text x={494} y={36} style={faint}>output_schema</text>
      <text x={450} y={62} style={mono}>element: "storm"</text>
      <text x={450} y={80} style={mono}>glyphs: circle, bar, diamond</text>
      <text x={450} y={98} style={mono}>incantation: "Unleash the</text>
      <text x={450} y={114} style={mono}>  tempest!"</text>
    </svg>
  );
}

/* spell_ready(): the arena, not Gemini, judges the spell; then store or retry. */
function SpellReadyNode() {
  const line = "var(--hairline-strong)";
  return (
    <svg viewBox="0 0 680 186" role="img"
         aria-label="spell_ready hands the sung spell to the arena, which judges it against the spell card's hidden answer. If it does damage, the spell is stored in state and the branch routes stored to rest. A misread does no damage, burns the spell card, and routes retry to read_rune for the new card.">
      <defs><Arrow id="sr-a" color={line} /></defs>
      <Box x={10} y={64} w={96} h={50} title="Sung" note="from Gemini" />
      <line x1="106" y1="89" x2="140" y2="89" stroke={line} markerEnd="url(#sr-a)" />
      <Box x={142} y={64} w={190} h={50} title="arena.sung()" note="judged against the hidden answer" />
      <line x1="332" y1="80" x2="380" y2="46" stroke="var(--accent)" markerEnd="url(#sr-a)" />
      <line x1="332" y1="98" x2="380" y2="132" stroke={line} markerEnd="url(#sr-a)" />
      <text x={334} y={56} style={faint}>damage</text>
      <text x={334} y={130} style={faint}>misread</text>
      <Box x={382} y={16} w={172} h={50} title={'state["spell"] = spell'} note="the slot is filled" accent />
      <line x1="554" y1="41" x2="584" y2="41" stroke={line} markerEnd="url(#sr-a)" />
      <Box x={586} y={16} w={84} h={50} title="stored" note="→ rest" />
      <Box x={382} y={112} w={172} h={50} title="the card is burned" note="no damage, a new card" />
      <line x1="554" y1="137" x2="584" y2="137" stroke={line} markerEnd="url(#sr-a)" />
      <Box x={586} y={112} w={84} h={50} title="retry" note="→ read_rune" />
      <text x={10} y={180} style={faint}>perfect reading 45 damage · two shapes right 25 · misread 0</text>
    </svg>
  );
}

/* The arena workflow exactly as `edges=[...]` defines it: every node, every
   routed edge with its route name. */
function GraphDefinition() {
  const fast = "var(--accent)";
  const line = "var(--hairline-strong)";
  const route = (x: number, y: number, word: string, color = "var(--fg-faint)") => (
    <text x={x} y={y} textAnchor="middle" style={{ ...mono, fontSize: 10, fill: color }}>{word}</text>
  );
  return (
    <svg viewBox="0 0 680 340" role="img"
         aria-label="The arena workflow graph. START goes to enter, which fans out to read_rune and tick. Slow branch: read_rune, spellwright, spell_ready; spell_ready routes retry back to read_rune, or stored to rest. Fast loop: tick routes next to check_spell, which routes again back to tick; tick routes recast to read_rune, and done to summarise, then bard, then finish.">
      <defs><Arrow id="gd-a" color={line} /><Arrow id="gd-b" color={fast} /></defs>

      <Box x={8} y={152} w={60} h={36} title="START" />
      <line x1="68" y1="170" x2="90" y2="170" stroke={line} markerEnd="url(#gd-a)" />
      <Box x={92} y={148} w={76} h={44} title="enter" note="the bell" />

      {/* fan-out */}
      <line x1="168" y1="160" x2="206" y2="72" stroke={line} markerEnd="url(#gd-a)" />
      <line x1="168" y1="180" x2="206" y2="232" stroke={fast} markerEnd="url(#gd-b)" />
      <text x={150} y={118} style={faint}>fan-out</text>
      <text x={14} y={70} style={faint}>slow branch</text>
      <text x={14} y={84} style={faint}>Gemini, seconds</text>
      <text x={14} y={262} style={{ ...faint, fill: fast }}>fast loop</text>
      <text x={14} y={276} style={{ ...faint, fill: fast }}>every tick</text>

      {/* slow branch */}
      <Box x={208} y={48} w={100} h={44} title="read_rune" note="spell card as PNG" />
      <line x1="308" y1="70" x2="326" y2="70" stroke={line} markerEnd="url(#gd-a)" />
      <Box x={328} y={48} w={100} h={44} title="spellwright" note="Gemini sings" dashed />
      <line x1="428" y1="70" x2="446" y2="70" stroke={line} markerEnd="url(#gd-a)" />
      <Box x={448} y={48} w={100} h={44} title="spell_ready" note="the arena judges" />
      <line x1="548" y1="70" x2="592" y2="70" stroke={line} markerEnd="url(#gd-a)" />
      {route(570, 60, "stored")}
      <Box x={594} y={48} w={80} h={44} title="rest" note="branch ends" />
      <path d="M498 48 C 498 14, 258 14, 258 46" fill="none" stroke={line} markerEnd="url(#gd-a)" />
      {route(378, 22, "retry")}

      {/* fast loop */}
      <Box x={208} y={214} w={124} h={44} title="tick" note="Discriminative model" accent />
      <line x1="332" y1="236" x2="360" y2="236" stroke={fast} markerEnd="url(#gd-b)" />
      {route(346, 228, "next", fast)}
      <Box x={362} y={214} w={104} h={44} title="check_spell" note="spell ready?" accent />
      <path d="M414 214 C 414 182, 280 182, 280 212" fill="none" stroke={fast} markerEnd="url(#gd-b)" />
      {route(347, 180, "again", fast)}
      <path d="M232 214 C 232 170, 232 130, 232 94" fill="none" stroke={fast} markerEnd="url(#gd-b)" />
      {route(206, 156, "recast", fast)}

      {/* the end of the match */}
      <path d="M258 258 C 258 300, 300 304, 326 304" fill="none" stroke={fast} markerEnd="url(#gd-b)" />
      {route(282, 296, "done", fast)}
      <Box x={328} y={284} w={104} h={40} title="summarise" note="the match log" />
      <line x1="432" y1="304" x2="456" y2="304" stroke={line} markerEnd="url(#gd-a)" />
      <Box x={458} y={284} w={90} h={40} title="bard" note="Gemini tells it" dashed />
      <line x1="548" y1="304" x2="572" y2="304" stroke={line} markerEnd="url(#gd-a)" />
      <Box x={574} y={284} w={84} h={40} title="finish" />
    </svg>
  );
}

/* ── step 6 ─────────────────────────────────────────────────────────────── */

function ThreeTools() {
  const tools: [number, string, string, boolean, boolean, string[]][] = [
    [12, "Code", "the rule is explicit", false, false, ["free · instant", "exact"]],
    [197, "Discriminative model", "the answer is bounded", true, false, ["~100 ms · micro-cents", "calibrated"]],
    [382, "Language model", "the answer is prose", false, true, ["seconds · cents", "checked by the Discriminative model"]],
  ];
  return (
    <svg viewBox="0 0 560 162" role="img" aria-label="Code, the Discriminative model and a language model, and what each answers">
      {tools.map(([x, title, note, accent, dashed, lines]) => (
        <g key={title}>
          <Box x={x} y={22} w={165} h={80} title={title} note={note} accent={accent} dashed={dashed} />
          {lines.map((line, k) => (
            <text key={line} x={x + 82.5} y={122 + k * 16} textAnchor="middle" style={faint}>{line}</text>
          ))}
        </g>
      ))}
    </svg>
  );
}

/* ── registry ───────────────────────────────────────────────────────────── */

export const FIGURES: Record<string, () => ReactNode> = {
  "two-paths": TwoPaths,
  "parallel-branch": ParallelBranch,
  "conversation-to-decisions": ConversationToDecisions,
  "system-components": SystemComponents,
  "moves-and-responses": MovesAndResponses,
  "app-structure": AppStructure,
  "serving-dataflow": ServingDataflow,
  "serving-stack": ServingStack,
  "request-path": RequestPath,
  "model-mode-structure": ModelModeStructure,
  "two-systems": TwoSystems,
  "one-request": OneRequest,
  "primitive-choice": PrimitiveChoice,
  "primitive-score": PrimitiveScore,
  "primitive-noul": PrimitiveNoul,
  "focused-questions": FocusedQuestions,
  "next-word-vs-blank": NextWordVsBlank,
  "how-probabilities": HowProbabilities,
  "confidence-from-spread": ConfidenceFromSpread,
  "threshold-bands": ThresholdBands,
  "choose-flow": ChooseFlow,
  "probability-bars": ProbabilityBars,
  "arena-flow": ArenaFlow,
  "cost-shape": CostShape,
  "arena-graph": ArenaGraph,
  "graph-definition": GraphDefinition,
  "event-loop": EventLoop,
  "workflow-mode-structure": WorkflowModeStructure,
  "tick-node": TickNode,
  "check-spell-node": CheckSpellNode,
  "read-rune-node": ReadRuneNode,
  "spellwright-node": SpellwrightNode,
  "spell-ready-node": SpellReadyNode,
  "three-tools": ThreeTools,
};

/* An image from content/images/, or a placeholder box that says where to put
   it, until the file is there. */
function ContentImage({ src, alt }: { src: string; alt: string }) {
  const [missing, setMissing] = useState(false);
  useEffect(() => setMissing(false), [src]);
  if (missing) {
    return (
      <div
        className="grid min-h-48 place-items-center rounded-lg border-2 border-dashed px-4 text-center text-sm"
        style={{ borderColor: "var(--hairline-strong)", background: "var(--card)", color: "var(--fg-faint)" }}
      >
        <div>
          <div className="font-semibold" style={{ color: "var(--fg-muted)" }}>Image placeholder</div>
          <div className="mt-1 font-mono text-xs">content/images/{src}</div>
        </div>
      </div>
    );
  }
  return (
    <img
      src={`/content-images/${src}`}
      alt={alt}
      onError={() => setMissing(true)}
      className="mx-auto block max-w-full rounded-lg"
    />
  );
}

export function Figure({ id, caption, src }: { id: string; caption: string; src?: string }) {
  const Drawing = FIGURES[id];

  return (
    <figure className="my-7">
      <div
        className="rounded-xl border p-4"
        style={{ background: "var(--overlay)", borderColor: "var(--hairline)" }}
      >
        {src ? (
          <ContentImage src={src} alt={caption || id} />
        ) : Drawing ? (
          <Drawing />
        ) : (
          <div
            className="grid h-28 place-items-center rounded-lg text-sm"
            style={{ background: "var(--card)", color: "var(--fg-faint)" }}
          >
            figure “{id || "unnamed"}” not drawn yet
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="mt-2.5 text-sm" style={{ color: "var(--fg-faint)" }}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
