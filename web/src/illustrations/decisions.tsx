/* Figures for the three decision models, the two SDKs, and the step 6 loop.

   Same house style as index.tsx, which registers them: inline SVG on the
   page's CSS variables, one idea per figure, the accent color for the thing
   being taught.
*/

import { useState } from "react";

import { CodePopup } from "../components/CodePopup";
import { Arrow, Box, faint, label, mono, strong } from "./parts";

const ACCENT = "var(--accent)";
const LINE = "var(--hairline-strong)";
const accentFaint = { ...faint, fill: ACCENT } as const;
const accentMono = { ...mono, fill: ACCENT } as const;

/* ── the three models ───────────────────────────────────────────────────── */

export function ThreeModels() {
  const cards: { x: number; title: string; by: string; rows: [string, string][]; accent?: boolean }[] = [
    { x: 10, title: "Jev", by: "TypeSafe AI · hosted",
      rows: [["runs", "api.typesafe.ai"], ["key", "TYPESAFE_API_KEY"], ["reads", "text"]] },
    { x: 226, title: "DiffusionGemma", by: "Google · open weights",
      rows: [["runs", "a GPU VM in your project"], ["key", "your Google identity"], ["reads", "text"]] },
    { x: 442, title: "Gemini Decisions", by: "Google · hosted", accent: true,
      rows: [["runs", "Gemini Developer API"], ["key", "GEMINI_API_KEY"], ["reads", "text · image · audio · video · PDF"]] },
  ];
  return (
    <svg viewBox="0 0 660 248" role="img"
         aria-label="Three decision models. Jev, hosted by TypeSafe AI, called with TYPESAFE_API_KEY, reads text. DiffusionGemma, Google's open-weights model on a GPU VM in your project, reached with your Google identity, reads text. Gemini Decisions, hosted by Google on the Gemini Developer API, called with GEMINI_API_KEY, reads text, images, audio, video and PDFs. Jev and DiffusionGemma are called with typesafe-sdk and client.system_one. Gemini Decisions is called with google-genai and client.decisions.create. All three take choice, score and noul questions and return probabilities and a confidence.">
      {cards.map((card) => (
        <g key={card.title}>
          <rect x={card.x} y={10} width={208} height={134} rx="10"
                fill={card.accent ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--card)"}
                stroke={card.accent ? ACCENT : LINE} />
          <text x={card.x + 14} y={32} style={{ ...strong, fontSize: 13 }}>{card.title}</text>
          <text x={card.x + 14} y={48} style={faint}>{card.by}</text>
          {card.rows.map(([name, value], i) => (
            <g key={name}>
              <text x={card.x + 14} y={72 + i * 18} style={{ ...faint, fontSize: 9.5, letterSpacing: 0.8 }}>{name.toUpperCase()}</text>
              <text x={name === "reads" ? card.x + 14 : card.x + 56} y={72 + i * 18 + (name === "reads" ? 16 : 0)}
                    style={{ ...label, fill: "var(--fg)" }}>{value}</text>
            </g>
          ))}
          <line x1={card.x + 104} y1={144} x2={card.x + 104} y2={162} stroke={card.accent ? ACCENT : LINE} />
        </g>
      ))}
      <rect x={10} y={162} width={424} height={38} rx="8" fill="var(--overlay)" stroke={LINE} />
      <text x={24} y={185} style={strong}>typesafe-sdk</text>
      <text x={420} y={185} textAnchor="end" style={mono}>client.system_one(state, questions)</text>
      <rect x={442} y={162} width={208} height={38} rx="8" fill="var(--overlay)" stroke={ACCENT} />
      <text x={456} y={178} style={strong}>google-genai</text>
      <text x={456} y={193} style={accentMono}>client.decisions.create(...)</text>
      <text x={330} y={228} textAnchor="middle" style={label}>
        The same questions: choice · score · noul. The same answers: probabilities and a confidence.
      </text>
    </svg>
  );
}

export function ModelLimits() {
  const rows: [string, string, string][] = [
    ["Input", "text", "text · image · audio · video · PDF"],
    ["Per request", "64k tokens", "262k tokens · up to 1,000 questions"],
    ["Choice", "up to 255 options", "up to 255 options"],
    ["Score", "2 to 10 levels", "2 to 10 levels work best"],
    ["Price", "$0.042 per 1M input tokens", "$0.10 per 1M input tokens"],
  ];
  return (
    <svg viewBox="0 0 640 196" role="img"
         aria-label="What each hosted model accepts. Jev: text input, 64 thousand tokens per request, up to 255 options per choice, 2 to 10 score levels, 0.042 dollars per million input tokens. Gemini Decisions: text, image, audio, video and PDF input, 262 thousand tokens and up to 1,000 questions per request, up to 255 options per choice, 2 to 10 score levels work best, 0.10 dollars per million input tokens.">
      <Box x={130} y={8} w={200} h={34} title="Jev" />
      <Box x={346} y={8} w={284} h={34} title="Gemini Decisions" accent />
      {rows.map(([name, jev, gemini], i) => {
        const y = 66 + i * 28;
        return (
          <g key={name}>
            <line x1="10" y1={y - 18} x2="630" y2={y - 18} stroke="var(--hairline)" />
            <text x={10} y={y} style={{ ...faint, fontSize: 9.5, letterSpacing: 0.8 }}>{name.toUpperCase()}</text>
            <text x={230} y={y} textAnchor="middle" style={label}>{jev}</text>
            <text x={488} y={y} textAnchor="middle" style={{ ...label, fill: "var(--fg)" }}>{gemini}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── step 0 ─────────────────────────────────────────────────────────────── */

export function GameMapping() {
  const rows: [string, string, string, boolean][] = [
    ["The opponent's move", "an incoming event", "a request, a transaction", false],
    ["Your response", "a bounded decision", "discriminative model + code", true],
    ["The spell card", "an image with a bounded answer", "discriminative model that reads images", true],
    ["The match", "a loop over events", "workflow", false],
    ["The tale of the fight", "open-ended text", "language model", false],
  ];
  return (
    <svg viewBox="0 0 660 196" role="img"
         aria-label="The game mapped to a production system. The opponent's move is an incoming event. Your response is a bounded decision, made by a discriminative model and code. The spell card is an image with a bounded answer, read by a discriminative model that takes images. The match is a loop over events, run by a workflow. The tale of the fight is open-ended text, written by a language model.">
      <defs><Arrow id="gm-a" color={LINE} /></defs>
      <text x={10} y={14} style={faint}>in the game</text>
      <text x={212} y={14} style={faint}>in a production system</text>
      <text x={440} y={14} style={faint}>handled by</text>
      {rows.map(([game, system, by, accent], i) => {
        const y = 24 + i * 34;
        return (
          <g key={game}>
            <Box x={10} y={y} w={166} h={28} title={game} />
            <line x1="176" y1={y + 14} x2="208" y2={y + 14} stroke={LINE} markerEnd="url(#gm-a)" />
            <Box x={210} y={y} w={216} h={28} title={system} accent={accent} />
            <text x={440} y={y + 18} style={accent ? accentFaint : label}>{by}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── step 1 ─────────────────────────────────────────────────────────────── */

export function ServingDataflow() {
  return (
    <svg viewBox="0 0 660 300" role="img"
         aria-label="The workshop code calls decisions.ask, which uses one of two SDKs. typesafe-sdk sends POST /v1/systemone, either to Jev at api.typesafe.ai over HTTPS with an API key, or through a gcloud IAP tunnel and Identity-Aware Proxy to a Compute Engine VM in your project running djev-run and vLLM with DiffusionGemma on a GPU. google-genai sends POST /v1beta/decisions to Gemini Decisions at generativelanguage.googleapis.com over HTTPS with an API key.">
      <defs><Arrow id="sd-a" color={LINE} /><Arrow id="sd-b" color={ACCENT} /></defs>

      <rect x={10} y={10} width={196} height={280} rx="12" fill="none" stroke={LINE} strokeDasharray="4 3" />
      <text x={24} y={32} style={strong}>Your machine</text>
      <text x={24} y={46} style={faint}>laptop or Cloud Shell</text>
      <Box x={24} y={56} w={168} h={40} title="Arena app · workflow" note="builds the request" />
      <line x1="108" y1="96" x2="108" y2="108" stroke={LINE} markerEnd="url(#sd-a)" />
      <Box x={24} y={110} w={168} h={40} title="decisions.ask()" note="picks the SDK" />
      <line x1="108" y1="150" x2="108" y2="166" stroke={LINE} markerEnd="url(#sd-a)" />
      <path d="M24 130 H 17 V 254 H 22" fill="none" stroke={ACCENT} markerEnd="url(#sd-b)" />
      <Box x={24} y={168} w={168} h={40} title="typesafe-sdk" note="POST /v1/systemone" />
      <Box x={24} y={234} w={168} h={40} title="google-genai" note="POST /v1beta/decisions" accent />

      {/* Jev */}
      <line x1="192" y1="180" x2="248" y2="52" stroke={LINE} markerEnd="url(#sd-a)" />
      <text x={228} y={104} style={faint}>HTTPS</text>
      <Box x={250} y={20} w={180} h={48} title="Jev" note="api.typesafe.ai · API key" dashed />
      <text x={440} y={48} style={faint}>hosted by TypeSafe AI</text>

      {/* DiffusionGemma */}
      <line x1="192" y1="192" x2="222" y2="170" stroke={LINE} markerEnd="url(#sd-a)" />
      <Box x={224} y={128} w={150} h={46} title="IAP tunnel" note="localhost:8096" />
      <line x1="374" y1="151" x2="394" y2="151" stroke={LINE} markerEnd="url(#sd-a)" />
      <rect x={396} y={90} width={254} height={104} rx="12" fill="none" stroke={LINE} strokeDasharray="4 3" />
      <text x={408} y={110} style={strong}>Compute Engine VM</text>
      <text x={530} y={110} style={faint}>your project</text>
      <Box x={406} y={124} w={112} h={46} title="djev-run" note=":8080 · Jev API" />
      <line x1="518" y1="147" x2="528" y2="147" stroke={LINE} markerEnd="url(#sd-a)" />
      <Box x={530} y={124} w={112} h={46} title="vLLM · GPU" note="DiffusionGemma" />

      {/* Gemini Decisions */}
      <line x1="192" y1="254" x2="248" y2="254" stroke={ACCENT} markerEnd="url(#sd-b)" />
      <text x={220} y={246} textAnchor="middle" style={accentFaint}>HTTPS</text>
      <Box x={250} y={228} w={250} h={52} title="Gemini Decisions" note="generativelanguage.googleapis.com · API key" accent />
      <text x={510} y={250} style={faint}>hosted by Google</text>
      <text x={510} y={266} style={mono}>gemini-decision-1</text>
    </svg>
  );
}

/* The same request through each SDK, and the answers they share. */
export function TwoSdks() {
  const card = (x: number, title: string, models: string, lines: [string, boolean][]) => (
    <g>
      <rect x={x} y={10} width={314} height={170} rx="10" fill="var(--overlay)" stroke="var(--hairline)" />
      <text x={x + 14} y={30} style={strong}>{title}</text>
      <text x={x + 300} y={30} textAnchor="end" style={faint}>{models}</text>
      {lines.map(([text, differs], i) => (
        <text key={text} x={x + 14} y={52 + i * 16} style={differs ? accentMono : mono}
              xmlSpace="preserve">{text}</text>
      ))}
    </g>
  );
  return (
    <svg viewBox="0 0 660 256" role="img"
         aria-label="The same request through two SDKs. The TypeSafe SDK, for Jev and DiffusionGemma, calls client.system_one with state and questions built from Choice and Noul objects. The Google Gen AI SDK, for Gemini Decisions, calls client.decisions.create with a model, an input, and questions as plain dicts with a type. Both return answers with the same fields: choice, noul, score, confidence and probabilities.">
      <defs><Arrow id="ts-a" color={LINE} /></defs>
      {card(10, "TypeSafe SDK", "Jev · DiffusionGemma", [
        ["client.system_one(", true],
        ["    state={\"telegraph\": ...},", true],
        ["    questions={", false],
        ["        \"response\": Choice(...),", false],
        ["        \"exposed\": Noul(...),", false],
        ["    },", false],
        [")", false],
      ])}
      {card(336, "Google Gen AI SDK", "Gemini Decisions", [
        ["client.decisions.create(", true],
        ["    model=\"gemini-decision-1\",", true],
        ["    input=\"...\",   # or an image", true],
        ["    questions={", false],
        ["        \"response\": {\"type\": \"choice\", ...},", false],
        ["        \"exposed\": {\"type\": \"noul\", ...},", false],
        ["    },", false],
        [")", false],
      ])}
      <line x1="167" y1="180" x2="250" y2="202" stroke={LINE} markerEnd="url(#ts-a)" />
      <line x1="493" y1="180" x2="410" y2="202" stroke={LINE} markerEnd="url(#ts-a)" />
      <rect x={30} y={204} width={600} height={42} rx="8"
            fill="color-mix(in srgb, var(--accent) 12%, transparent)" stroke={ACCENT} />
      <text x={44} y={222} style={strong}>the same answers</text>
      <text x={44} y={238} style={mono}>answers["response"].choice · .confidence · .probabilities · answers["exposed"].noul</text>
    </svg>
  );
}

/* ── step 2 ─────────────────────────────────────────────────────────────── */

export function ModelKeys() {
  const uses: [number, string, string, boolean, boolean][] = [
    [10, "Fight with Jev", "the decision model, if you choose it", false, false],
    [54, "Fight with DiffusionGemma", "no key · your Google identity", false, true],
    [98, "Fight with Gemini Decisions", "the decision model, if you choose it", true, false],
    [142, "Step 6 · read the spell card", "Gemini Decisions · every choice", true, false],
    [186, "Step 6 · write the tale", "Gemini · every choice", true, false],
  ];
  return (
    <svg viewBox="0 0 640 232" role="img"
         aria-label="Which key is used where. TYPESAFE_API_KEY, from console.typesafe.ai, is used to fight with Jev. DiffusionGemma needs no key; it uses your Google identity. GEMINI_API_KEY, from aistudio.google.com, is used to fight with Gemini Decisions, and in step 6, for every choice, to read the spell card with Gemini Decisions and to write the tale with Gemini.">
      <defs><Arrow id="mk-a" color={LINE} /><Arrow id="mk-b" color={ACCENT} /></defs>
      <Box x={10} y={8} w={210} h={42} title="TYPESAFE_API_KEY" note="console.typesafe.ai" />
      <Box x={10} y={132} w={210} h={42} title="GEMINI_API_KEY" note="aistudio.google.com/apikey" accent />
      <line x1="220" y1="29" x2="296" y2="29" stroke={LINE} markerEnd="url(#mk-a)" />
      <line x1="220" y1="146" x2="296" y2="118" stroke={ACCENT} markerEnd="url(#mk-b)" />
      <line x1="220" y1="153" x2="296" y2="160" stroke={ACCENT} markerEnd="url(#mk-b)" />
      <line x1="220" y1="160" x2="296" y2="202" stroke={ACCENT} markerEnd="url(#mk-b)" />
      {uses.map(([y, title, note, accent, dashed]) => (
        <Box key={title} x={298} y={y} w={332} h={38} title={title} note={note} accent={accent} dashed={dashed} />
      ))}
    </svg>
  );
}

/* ── step 5 ─────────────────────────────────────────────────────────────── */

const QUESTIONS_JSON = {
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
};
const STATE_JSON = {
  opponent: "a nine-foot ogre with a spiked club, thick hide, and a short temper",
  telegraph: "The ogre staggers, off balance, its guard wide open.",
};

const FULL_REQUEST = `# Jev, and DiffusionGemma behind djev-run
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer $TYPESAFE_API_KEY
Content-Type: application/json

${JSON.stringify({ model: "jev-latest", state: STATE_JSON, questions: QUESTIONS_JSON }, null, 2)}


# Gemini Decisions
POST https://generativelanguage.googleapis.com/v1beta/decisions
x-goog-api-key: $GEMINI_API_KEY
Content-Type: application/json

${JSON.stringify({ model: "gemini-decision-1", input: JSON.stringify(STATE_JSON), questions: QUESTIONS_JSON }, null, 2)}`;

const FULL_RESPONSE = `# Jev
${JSON.stringify({
  model: "jev-1.13",
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
}, null, 2)}


# Gemini Decisions
${JSON.stringify({
  answers: {
    response: {
      type: "choice",
      choice: "strike",
      confidence: 1.0,
      probabilities: { block_high: 0.0, block_low: 0.0, dodge: 0.0, strike: 1.0, wait: 0.0 },
    },
    exposed: { type: "noul", noul: 0.98, confidence: 0.98 },
  },
  usage: { total_input_tokens: 252, total_output_tokens: 0 },
}, null, 2)}`;

export function RequestPath() {
  const [open, setOpen] = useState<"" | "request" | "response">("");
  const card = (x: number, y: number, h: number, title: string, lines: string[]) => (
    <g>
      <rect x={x} y={y} width={236} height={h} rx="8" fill="var(--overlay)" stroke="var(--hairline)" />
      <text x={x + 12} y={y + 18} style={accentFaint}>{title}</text>
      {lines.map((line, i) => (
        <text key={line} x={x + 12} y={y + 36 + i * 15} style={mono}>{line}</text>
      ))}
    </g>
  );
  const button = (which: "request" | "response") => ({
    role: "button", tabIndex: 0, style: { cursor: "pointer" },
    onClick: () => setOpen(which),
    onKeyDown: (event: { key: string }) => { if (event.key === "Enter" || event.key === " ") setOpen(which); },
  });
  return (
    <svg viewBox="0 0 660 270" role="img"
         aria-label="Your code calls ask with the state, a choice question and a noul question. The request goes to one of three models. Jev, through typesafe-sdk, at POST /v1/systemone. DiffusionGemma, through typesafe-sdk, at the same API on your VM. Gemini Decisions, through google-genai, at POST /v1beta/decisions. The response gives the choice with its confidence and the noul as a probability, and reports the input tokens, with no output tokens.">
      <defs><Arrow id="rp-a" color={ACCENT} /><Arrow id="rp-b" color={LINE} /></defs>

      <Box x={14} y={106} w={150} h={58} title="Your code" note="ask(state, questions)" accent />

      <g aria-label="Show the full HTTP request, for each API" {...button("request")}>
        {card(176, 10, 100, "request", [
          "state: opponent, telegraph",
          "response: choice of 5",
          "exposed: noul",
        ])}
        <text x={400} y={28} textAnchor="end" style={accentFaint}>show in full ⤢</text>
      </g>
      <line x1="164" y1="122" x2="420" y2="122" stroke={ACCENT} strokeWidth="1.5" markerEnd="url(#rp-a)" />
      <line x1="422" y1="148" x2="168" y2="148" stroke={ACCENT} strokeWidth="1.5" markerEnd="url(#rp-a)" />
      <g aria-label="Show the full HTTP response, from each API" {...button("response")}>
        {card(176, 160, 100, "response", [
          "response: strike · conf 0.96",
          "exposed: 0.97",
          "usage: 190 input · 0 output",
        ])}
        <text x={400} y={178} textAnchor="end" style={accentFaint}>show in full ⤢</text>
      </g>

      {/* one of three models */}
      <line x1="428" y1="43" x2="428" y2="227" stroke={LINE} />
      {[43, 135, 227].map((y) => (
        <line key={y} x1="428" y1={y} x2="442" y2={y} stroke={LINE} markerEnd="url(#rp-b)" />
      ))}
      <Box x={444} y={18} w={206} h={50} title="Jev" note="typesafe-sdk · /v1/systemone" dashed />
      <Box x={444} y={110} w={206} h={50} title="DiffusionGemma" note="typesafe-sdk · same API, your VM" dashed />
      <Box x={444} y={202} w={206} h={50} title="Gemini Decisions" note="google-genai · /v1beta/decisions" accent />
      <text x={547} y={90} textAnchor="middle" style={faint}>or</text>
      <text x={547} y={184} textAnchor="middle" style={faint}>or</text>
      {open === "request" && <CodePopup title="HTTP request" code={FULL_REQUEST} onClose={() => setOpen("")} />}
      {open === "response" && <CodePopup title="HTTP response" code={FULL_RESPONSE} onClose={() => setOpen("")} />}
    </svg>
  );
}

export function LatencyScale() {
  const scale = (seconds: number) => 190 + seconds * 100;
  const rows: [string, string, number, number, boolean, boolean][] = [
    ["One decision", "0.1 to 0.5 s", 0, 0.5, true, false],
    ["Your timer in step 3", "2 s", 0, 2, false, false],
    ["A language model writing", "2 to 4 s", 0, 4, false, true],
  ];
  return (
    <svg viewBox="0 0 680 150" role="img"
         aria-label="A time scale in seconds. One decision takes 0.1 to 0.5 seconds. The timer you played against in step 3 was 2 seconds. A language model writing an answer takes 2 to 4 seconds.">
      {[0, 1, 2, 3, 4].map((s) => (
        <g key={s}>
          <line x1={scale(s)} y1={16} x2={scale(s)} y2={118} stroke="var(--hairline)" />
          <text x={scale(s)} y={136} textAnchor="middle" style={faint}>{s} s</text>
        </g>
      ))}
      {rows.map(([name, time, from, to, accent, dashed], i) => {
        const y = 28 + i * 32;
        return (
          <g key={name}>
            <text x={10} y={y + 13} style={accent ? { ...strong, fill: ACCENT } : label}>{name}</text>
            <rect x={scale(from)} y={y} width={scale(to) - scale(from)} height={18} rx="5"
                  fill={accent ? ACCENT : "color-mix(in srgb, var(--fg-faint) 30%, transparent)"}
                  stroke={accent ? ACCENT : LINE} strokeDasharray={dashed ? "4 3" : undefined} />
            <text x={scale(to) + 8} y={y + 13} style={accent ? accentMono : mono}>{time}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── step 6 ─────────────────────────────────────────────────────────────── */



/* 6b: one image, four choice questions, four answers. */
export function CardQuestions() {
  const storm = "#a86ef0";
  const rows: [string, string, string, string][] = [
    ["element", "choice of 4 colors", "storm", "0.99"],
    ["first", "choice of 8 shapes", "square", "0.99"],
    ["second", "choice of 8 shapes", "triangle", "0.98"],
    ["third", "choice of 8 shapes", "circle", "0.99"],
  ];
  return (
    <svg viewBox="0 0 660 232" role="img"
         aria-label="A spell card image, purple with a square, a triangle and a circle, goes to gemini-decision-1 in one call with four choice questions: element, a choice of four colors, and first, second and third, each a choice of eight shapes. Four answers come back: storm, square, triangle and circle, each with a confidence near 0.99. There are no output tokens.">
      <defs><Arrow id="cq-a" color={LINE} /><Arrow id="cq-b" color={ACCENT} /></defs>

      {/* the card */}
      <text x={10} y={54} style={faint}>input · the spell card as PNG</text>
      <rect x={10} y={64} width={156} height={84} rx="8" fill="var(--card)" stroke={storm} strokeWidth="3" />
      <rect x={30} y={90} width={32} height={32} fill={storm} />
      <polygon points="88,90 106,122 70,122" fill={storm} />
      <circle cx={132} cy={106} r={16} fill={storm} />
      <text x={88} y={166} textAnchor="middle" style={mono}>{'{"type": "image", ...}'}</text>

      <line x1="166" y1="106" x2="204" y2="106" stroke={LINE} markerEnd="url(#cq-a)" />
      <text x={330} y={14} textAnchor="middle" style={accentFaint}>one call · gemini-decision-1 · no output tokens</text>

      {rows.map(([name, kind, answer, confidence], i) => {
        const y = 24 + i * 50;
        return (
          <g key={name}>
            <Box x={206} y={y} w={190} h={40} title={`"${name}"`} note={kind} accent />
            <line x1="396" y1={y + 20} x2="438" y2={y + 20} stroke={ACCENT} markerEnd="url(#cq-b)" />
            <rect x={440} y={y} width={210} height={40} rx="8" fill="var(--overlay)" stroke="var(--hairline)" />
            <text x={454} y={y + 25} style={strong}>{answer}</text>
            <text x={636} y={y + 25} textAnchor="end" style={mono}>confidence {confidence}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* 6a: the fight loop, the card reader beside it, and state between them. */
export function ArenaGraph() {
  return (
    <svg viewBox="0 0 660 262" role="img"
         aria-label="The bell, enter, starts two things at once. In the background, read_card: Gemini Decisions reads the spell card and writes the spell into shared state. Alongside it, tick: your decision model answers once per tick, loops on itself with the route next, and reads the spell from state every tick. The two never call each other. After a cast, tick also routes read, which starts read_card again for the new card. When the fight is over, tick routes done to summarize and then bard, where Gemini writes the tale.">
      <defs><Arrow id="ag-a" color={LINE} /><Arrow id="ag-b" color={ACCENT} /></defs>

      <Box x={10} y={103} w={84} h={48} title="enter" note="the bell" />
      <line x1="94" y1="118" x2="150" y2="52" stroke={LINE} markerEnd="url(#ag-a)" />
      <line x1="94" y1="136" x2="150" y2="196" stroke={ACCENT} markerEnd="url(#ag-b)" />
      <text x={100} y={108} style={faint}>both start</text>

      {/* the card reader */}
      <text x={152} y={14} style={faint}>card reader · in the background · about half a second per card</text>
      <Box x={152} y={22} w={230} h={54} title="read_card" note="Gemini Decisions reads the image" dashed />

      {/* shared state */}
      <line x1="267" y1="76" x2="267" y2="100" stroke={LINE} strokeDasharray="3 3" markerEnd="url(#ag-a)" />
      <text x={275} y={92} style={faint}>writes</text>
      <rect x={182} y={102} width={170} height={48} rx="8" fill="var(--overlay)" stroke={LINE} strokeDasharray="5 3" />
      <text x={267} y={122} textAnchor="middle" style={strong}>shared state</text>
      <text x={267} y={139} textAnchor="middle" style={mono}>spell ready?</text>
      <line x1="267" y1="150" x2="267" y2="172" stroke={ACCENT} strokeDasharray="3 3" markerEnd="url(#ag-b)" />
      <text x={275} y={166} style={accentFaint}>reads, every tick</text>

      {/* the fight loop */}
      <Box x={152} y={174} w={230} h={54} title="tick" note="your decision model · every tick" accent />
      <path d="M200 228 C 200 258, 320 258, 320 230" fill="none" stroke={ACCENT} markerEnd="url(#ag-b)" />
      <text x={150} y={250} textAnchor="end" style={accentMono}>"next"</text>
      <text x={152} y={250} style={accentFaint}> fight loop</text>

      {/* after a cast: read the new card */}
      <path d="M382 190 C 440 190, 440 60, 384 50" fill="none" stroke={ACCENT} markerEnd="url(#ag-b)" />
      <text x={446} y={116} style={accentMono}>"read"</text>
      <text x={446} y={130} style={faint}>after a cast:</text>
      <text x={446} y={143} style={faint}>a new card is up</text>

      {/* the end */}
      <line x1="382" y1="212" x2="440" y2="212" stroke={ACCENT} markerEnd="url(#ag-b)" />
      <text x={411} y={206} textAnchor="middle" style={accentMono}>"done"</text>
      <Box x={442} y={190} w={96} h={46} title="summarize" note="the fight log" />
      <line x1="538" y1="213" x2="552" y2="213" stroke={LINE} markerEnd="url(#ag-a)" />
      <Box x={554} y={190} w={96} h={46} title="bard" note="Gemini · the tale" dashed />
    </svg>
  );
}

/* 6a: the routes tick can return. */
export function LoopRoutes() {
  const outcomes: [number, string, string, string, boolean][] = [
    [10, '["next"]', "tick", "the fight goes on", true],
    [78, '["read", "next"]', "read_card and tick", "a spell was cast · read the new card, keep fighting", true],
    [146, '["done"]', "summarize, then bard", "0 HP, or tick 45", false],
  ];
  return (
    <svg viewBox="0 0 680 206" role="img"
         aria-label="After each exchange, tick returns its routes. Next, while the fight goes on: tick again. Read and next together, when a spell was just cast: read_card starts in the background for the new card, and tick goes on. Done, at 0 HP or tick 45: summarize, then bard.">
      <defs><Arrow id="lr-a" color={LINE} /><Arrow id="lr-b" color={ACCENT} /></defs>
      <Box x={10} y={76} w={120} h={54} title="tick" note="one exchange" accent />
      <line x1="130" y1="103" x2="158" y2="103" stroke={LINE} markerEnd="url(#lr-a)" />
      <polygon points="160,103 196,77 232,103 196,129" fill="var(--card)" stroke={ACCENT} strokeWidth="1.5" />
      <text x={196} y={108} textAnchor="middle" style={{ ...strong, fontSize: 13 }}>?</text>
      <text x={196} y={150} textAnchor="middle" style={faint}>fight over?</text>
      <text x={196} y={164} textAnchor="middle" style={faint}>spell just cast?</text>
      {outcomes.map(([y, route, title, note, accent]) => (
        <g key={route}>
          <line x1="232" y1="103" x2="378" y2={y + 25} stroke={accent ? ACCENT : LINE}
                markerEnd={`url(#lr-${accent ? "b" : "a"})`} />
          <text x={370} y={y + 12} textAnchor="end" style={accentMono}>{`route=${route}`}</text>
          <Box x={380} y={y} w={290} h={50} title={title} note={note} accent={accent} />
        </g>
      ))}
    </svg>
  );
}

/* 6a: one event loop. One runs until it awaits its model, then the other runs. */
export function CardAlongside() {
  const run = (x1: number, x2: number, y: number, name: string, color: string) => (
    <g key={`${name}-${x1}`}>
      <rect x={x1} y={y - 13} width={x2 - x1} height={26} rx="5"
            fill={`color-mix(in srgb, ${color} 18%, transparent)`} stroke={color} />
      <text x={(x1 + x2) / 2} y={y + 4} textAnchor="middle" style={{ ...mono, fontSize: 10, fill: "var(--fg)" }}>{name}</text>
    </g>
  );
  const wait = (x1: number, x2: number, y: number, word: string, color: string) => (
    <g key={`w-${x1}-${y}`}>
      <line x1={x1 + 2} y1={y} x2={x2 - 4} y2={y} stroke={color} strokeDasharray="4 4" markerEnd="url(#ca-a)" />
      {word && <text x={(x1 + x2) / 2} y={y - 8} textAnchor="middle" style={faint}>{word}</text>}
    </g>
  );
  const card = "var(--fg-muted)";
  return (
    <svg viewBox="0 0 680 186" role="img"
         aria-label="One event loop in one thread. The card reader runs read_card, waits at an await for Gemini Decisions, then stores the spell. The fight runs tick, waits at an await for the decision model, and runs tick again, several times, while the card is being read. Only one runs at a time, and each runs while the other is waiting. The tick after the spell is stored has cast among its options.">
      <defs><Arrow id="ca-a" color={LINE} /></defs>
      <text x={10} y={20} style={strong}>One event loop, one thread</text>
      <text x={198} y={20} style={faint}>it switches between them at every await</text>

      <text x={10} y={70} style={label}>card reader</text>
      {run(110, 190, 66, "read_card", card)}
      {wait(190, 420, 66, "await Gemini Decisions", card)}
      {run(420, 516, 66, "spell → state", card)}

      <text x={10} y={130} style={{ ...label, fill: ACCENT }}>fight loop</text>
      {run(190, 230, 126, "tick", ACCENT)}
      {wait(230, 300, 126, "await model", ACCENT)}
      {run(300, 340, 126, "tick", ACCENT)}
      {wait(340, 420, 126, "await model", ACCENT)}
      {run(430, 470, 126, "tick", ACCENT)}
      {wait(470, 580, 126, "await model", ACCENT)}
      {run(580, 668, 126, "tick · cast?", ACCENT)}
      <line x1="516" y1="78" x2="600" y2="110" stroke={LINE} strokeDasharray="3 3" markerEnd="url(#ca-a)" />

      <text x={10} y={174} style={faint}>Solid: running. Dashed: waiting at an await, while the event loop runs the other one.</text>
    </svg>
  );
}

function StepRow({ steps, prefix }: { steps: [string, string, boolean][]; prefix: string }) {
  return (
    <>
      {steps.map(([title, note, accent], i) => (
        <g key={title}>
          <Box x={10 + i * 134} y={30} w={118} h={50} title={title} note={note} accent={accent} />
          {i < steps.length - 1 && (
            <line x1={128 + i * 134} y1="55" x2={142 + i * 134} y2="55" stroke={LINE} markerEnd={`url(#${prefix}-a)`} />
          )}
        </g>
      ))}
    </>
  );
}

/* 6b: one pass through read_card(). */
export function ReadCardNode() {
  return (
    <svg viewBox="0 0 680 118" role="img"
         aria-label="One pass through read_card: take the card off the arena's screen as a PNG, ask Gemini Decisions four choice questions with decisions.create, read the element and three shapes from the answers, let the arena judge the reading, and write the spell into state, or None after a misread. It returns no output; the fight reads the spell from state.">
      <defs><Arrow id="rc-a" color={LINE} /></defs>
      <text x={10} y={18} style={faint}>read_card · alongside the fight · one call to Gemini Decisions, with the Google Gen AI SDK</text>
      <StepRow prefix="rc" steps={[
        ["arena.rune_png", "the card, as PNG", false],
        ["decisions.create", "4 choice questions", true],
        ["answers", "element + 3 shapes", false],
        ["arena.sung", "the arena judges", false],
        ["state[\"spell\"]", "ready, or None", false],
      ]} />
      <text x={670} y={104} textAnchor="end" style={faint}>no output: the fight reads state</text>
    </svg>
  );
}



/* 6b: one pass through tick(), and the routes it returns. */
export function TickNode() {
  const routeLabel = (x: number, y: number, text: string, anchor: "start" | "middle" | "end" = "middle") => (
    <text x={x} y={y} textAnchor={anchor} style={{ ...accentMono, fontSize: 10.5 }}>{text}</text>
  );
  return (
    <svg viewBox="0 0 680 262" role="img"
         aria-label="One pass through tick: read whether a spell is ready from state, get the ogre's move from the arena, ask your decision model with ask_async, apply the thresholds in choose(), and let the arena resolve the blow. Then the routes: next, back to tick, while the fight goes on; read and next together, to read_card and tick, when a spell was just cast; done, to summarize, when someone reaches 0 HP or tick 45.">
      <defs><Arrow id="tn-a" color={LINE} /><Arrow id="tn-b" color={ACCENT} /></defs>
      <text x={10} y={18} style={faint}>one tick · ask_async is awaited, so the card reader keeps running</text>
      <StepRow prefix="tn" steps={[
        ["state[\"spell\"]", "is a spell ready?", false],
        ["arena.telegraph", "the ogre's move", false],
        ["ask_async", "your decision model", true],
        ["choose()", "thresholds → action", false],
        ["arena.respond", "resolves the blow", false],
      ]} />

      <path d="M605 80 V 110 H 372" fill="none" stroke={LINE} markerEnd="url(#tn-a)" />
      <polygon points="308,98 372,98 340,142" fill="var(--card)" stroke={ACCENT} strokeWidth="1.5" />
      <text x={340} y={116} textAnchor="middle" style={{ ...strong, fontSize: 13 }}>?</text>
      <text x={300} y={112} textAnchor="end" style={faint}>fight over? spell just cast?</text>

      <line x1="334" y1="142" x2="126" y2="198" stroke={ACCENT} markerEnd="url(#tn-b)" />
      <line x1="340" y1="142" x2="340" y2="198" stroke={ACCENT} markerEnd="url(#tn-b)" />
      <line x1="346" y1="142" x2="554" y2="198" stroke={LINE} markerEnd="url(#tn-a)" />
      {routeLabel(214, 164, 'route=["next"]', "end")}
      {routeLabel(333, 191, 'route=["read", "next"]', "end")}
      {routeLabel(478, 160, 'route=["done"]', "start")}

      <Box x={22} y={200} w={200} h={50} title="tick" note="the fight goes on" accent />
      <Box x={240} y={200} w={200} h={50} title="read_card + tick" note="a spell was cast; keep fighting too" accent />
      <Box x={458} y={200} w={200} h={50} title="summarize" note="0 HP, or tick 45" />
    </svg>
  );
}

/* 6c: the edges of the graph, as the Workflow definition draws them. */
export function GraphDefinition() {
  const route = (x: number, y: number, word: string) => (
    <text x={x} y={y} textAnchor="middle" style={{ ...accentMono, fontSize: 10 }}>{word}</text>
  );
  return (
    <svg viewBox="0 0 680 300" role="img"
         aria-label="The arena workflow graph. START goes to enter, which fans out to read_card and tick. Card reader: read_card routes again back to itself after a misread, or stored to rest, where it ends. Fight loop: tick routes next back to itself, read to read_card after a cast, and done to summarize, then bard, then finish.">
      <defs><Arrow id="gd-a" color={LINE} /><Arrow id="gd-b" color={ACCENT} /></defs>

      <Box x={8} y={132} w={60} h={36} title="START" />
      <line x1="68" y1="150" x2="90" y2="150" stroke={LINE} markerEnd="url(#gd-a)" />
      <Box x={92} y={128} w={76} h={44} title="enter" note="the bell" />

      {/* fan-out */}
      <line x1="168" y1="140" x2="216" y2="72" stroke={LINE} markerEnd="url(#gd-a)" />
      <line x1="168" y1="160" x2="216" y2="214" stroke={ACCENT} markerEnd="url(#gd-b)" />
      <text x={150} y={104} style={faint}>fan-out</text>
      <text x={14} y={62} style={faint}>card reader</text>
      <text x={14} y={76} style={faint}>Gemini Decisions</text>
      <text x={14} y={236} style={accentFaint}>fight loop</text>
      <text x={14} y={250} style={accentFaint}>every tick</text>

      {/* card reader */}
      <Box x={218} y={46} w={150} h={46} title="read_card" note="spell card as PNG" dashed />
      <path d="M260 46 C 260 10, 330 10, 330 44" fill="none" stroke={LINE} markerEnd="url(#gd-a)" />
      {route(295, 12, '"again"')}
      <line x1="368" y1="69" x2="436" y2="69" stroke={LINE} markerEnd="url(#gd-a)" />
      {route(402, 61, '"stored"')}
      <Box x={438} y={46} w={110} h={46} title="rest" note="reader ends" />

      {/* fight loop */}
      <Box x={218} y={196} w={150} h={46} title="tick" note="decision model" accent />
      <path d="M260 242 C 260 280, 330 280, 330 244" fill="none" stroke={ACCENT} markerEnd="url(#gd-b)" />
      {route(295, 290, '"next"')}
      <line x1="293" y1="196" x2="293" y2="94" stroke={ACCENT} markerEnd="url(#gd-b)" />
      {route(316, 148, '"read"')}

      {/* the end */}
      <line x1="368" y1="219" x2="436" y2="219" stroke={ACCENT} markerEnd="url(#gd-b)" />
      {route(402, 211, '"done"')}
      <Box x={438} y={196} w={110} h={46} title="summarize" note="the fight log" />
      <line x1="548" y1="219" x2="562" y2="219" stroke={LINE} markerEnd="url(#gd-a)" />
      <Box x={564} y={196} w={106} h={46} title="bard" note="Gemini · the tale" dashed />
      <line x1="617" y1="242" x2="617" y2="258" stroke={LINE} markerEnd="url(#gd-a)" />
      <Box x={564} y={260} w={106} h={32} title="finish" />
    </svg>
  );
}

/* 6c: the arena app with the workflow mode added, and the ADK workflow it
   starts in its own process. Step 5's files are muted; step 6's are lit. */
export function WorkflowModeStructure() {
  const group = (x: number, y: number, w: number, h: number, title: string, note: string, lit = false, muted = false) => (
    <g opacity={muted ? 0.55 : 1}>
      <rect x={x} y={y} width={w} height={h} rx="12"
            fill={lit ? "color-mix(in srgb, var(--accent) 6%, transparent)" : "none"}
            stroke={lit ? ACCENT : LINE} strokeDasharray="4 3" />
      <text x={x + 12} y={y + 20} style={strong}>{title}</text>
      <text x={x + 12} y={y + 34} style={faint}>{note}</text>
    </g>
  );
  const arrow = (d: string, color = LINE, id = "wm-a", dashed = false) => (
    <path d={d} fill="none" stroke={color} strokeDasharray={dashed ? "4 3" : undefined} markerEnd={`url(#${id})`} />
  );
  return (
    <svg viewBox="0 0 760 340" role="img"
         aria-label="The arena app with the workflow mode. The game from step 3: main.py, engine.py, sigil.py and static/app.js. The model mode from step 5: mode_model.py, reflex.py and static/modes/model.js. Step 6 adds mode_workflow.py, which starts the ADK workflow in agents/arena/agent.py as its own process, and static/modes/workflow.js, which draws the workflow fight. The workflow plays over HTTP, posting moves and card readings back to the app, uses reflex.py's questions and choose(), and calls your decision model, Gemini Decisions and Gemini.">
      <defs><Arrow id="wm-a" color={LINE} /><Arrow id="wm-b" color={ACCENT} /></defs>

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

      {group(516, 10, 234, 170, "The ADK workflow", "its own process", true)}
      <rect x={528} y={50} width={210} height={118} rx="8"
            fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke={ACCENT} />
      <text x={633} y={72} textAnchor="middle" style={strong}>agents/arena/agent.py</text>
      {["fight loop: tick", "card reader: read_card", "end: summarize, bard"].map((t, i) => (
        <text key={t} x={633} y={96 + i * 20} textAnchor="middle" style={mono}>{t}</text>
      ))}

      {group(516, 192, 234, 138, "The models", "outside the app")}
      <Box x={528} y={234} w={210} h={40} title="Your decision model" note="tick · either SDK" />
      <Box x={528} y={280} w={210} h={40} title="Gemini Decisions · Gemini" note="read_card · bard · GEMINI_API_KEY" />

      {arrow("M188 79 C 225 79, 225 234, 260 234")}
      <text x={225} y={140} textAnchor="middle" style={faint}>loads</text>
      {arrow("M188 289 L 260 289")}
      <text x={225} y={283} textAnchor="middle" style={faint}>loads</text>
      {arrow("M434 226 C 481 226, 481 120, 526 120", ACCENT, "wm-b")}
      <text x={462} y={196} textAnchor="middle" style={faint}>starts</text>
      {arrow("M528 150 C 481 150, 481 250, 436 250", LINE, "wm-a", true)}
      <text x={481} y={272} textAnchor="middle" style={faint}>moves, readings</text>
      <text x={481} y={285} textAnchor="middle" style={faint}>over HTTP</text>
      {arrow("M528 68 C 481 68, 481 101, 436 101", LINE, "wm-a", true)}
      <text x={481} y={52} textAnchor="middle" style={faint}>questions,</text>
      <text x={481} y={64} textAnchor="middle" style={faint}>choose()</text>
      {arrow("M633 168 L 633 232", ACCENT, "wm-b")}
      {arrow("M738 140 C 756 140, 756 300, 740 300", ACCENT, "wm-b")}
    </svg>
  );
}

/* ── step 7 ─────────────────────────────────────────────────────────────── */

export function ThreeTools() {
  const tools: [number, string, string, boolean, boolean, string[]][] = [
    [12, "Code", "the rule is explicit", false, false, ["free · instant", "exact"]],
    [197, "Discriminative model", "the answer is bounded", true, false, ["70–500 ms · fractions of a cent", "calibrated · text, or an image"]],
    [382, "Language model", "the answer is prose", false, true, ["seconds · cents", "open-ended text"]],
  ];
  return (
    <svg viewBox="0 0 560 162" role="img"
         aria-label="Code, when the rule is explicit: free, instant, exact. A discriminative model, when the answer is bounded: 70 to 500 milliseconds, fractions of a cent, calibrated, about text or an image. A language model, when the answer is prose: seconds, cents, open-ended text.">
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
