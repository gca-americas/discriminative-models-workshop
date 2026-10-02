/* Questions from the arena, one primitive each. The student picks once; the card explains, and the count at the top keeps score. */

import { useState } from "react";

type Primitive = "choice" | "score" | "noul";

const QUESTIONS: { text: string; answer: Primitive; why: string }[] = [
  {
    text: "The ogre raised its club. What is the right response?",
    answer: "choice",
    why: "One option from a set with no order between them: block high, block low, dodge, strike, wait.",
  },
  {
    text: "Is the ogre exposed to a counter right now?",
    answer: "noul",
    why: "A yes/no question. The probability itself is the useful answer.",
  },
  {
    text: "How hard will this hit land if I do nothing?",
    answer: "score",
    why: "A matter of degree along levels you can describe: none, light, heavy.",
  },
  {
    text: "Is this a feint?",
    answer: "noul",
    why: "A statement that is either true or not. Threshold the probability.",
  },
  {
    text: "How tired does the ogre look?",
    answer: "score",
    why: "Fresh, winded, spent: ordered levels. The answer can land between two of them.",
  },
  {
    text: "Which of the six spells suits this opponent?",
    answer: "choice",
    why: "A fixed set of options, no order. Choice handles up to 255 of them.",
  },
];

const PRIMITIVES: { id: Primitive; label: string }[] = [
  { id: "choice", label: "Choice" },
  { id: "score", label: "Score" },
  { id: "noul", label: "Noul" },
];

export function PrimitivePicker() {
  const [picked, setPicked] = useState<Record<number, Primitive>>({});
  const right = QUESTIONS.filter((q, i) => picked[i] === q.answer).length;
  const answered = Object.keys(picked).length;
  const finished = answered === QUESTIONS.length;

  return (
    <div className="space-y-3">
      <div
        className="flex items-center justify-between rounded-xl border px-4 py-2 text-sm"
        style={{ borderColor: "var(--hairline)", background: "var(--overlay)", color: "var(--fg-muted)" }}
        aria-live="polite"
      >
        <span>
          <b style={{ color: "var(--fg)" }}>{right}</b> of {QUESTIONS.length} right
        </span>
        <span className="text-xs" style={{ color: "var(--fg-faint)" }}>
          {finished ? "all answered" : `${answered} of ${QUESTIONS.length} answered`}
        </span>
      </div>
      {QUESTIONS.map((question, index) => {
        const choice = picked[index];
        const done = choice !== undefined;
        const correct = choice === question.answer;
        return (
          <div
            key={index}
            className="rounded-2xl border px-4 py-3"
            style={{ borderColor: "var(--hairline)", background: "var(--overlay)" }}
          >
            <div className="text-sm" style={{ color: "var(--fg)" }}>
              “{question.text}”
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {PRIMITIVES.map((primitive) => {
                const active = choice === primitive.id;
                const reveal = done && primitive.id === question.answer;
                return (
                  <button
                    key={primitive.id}
                    type="button"
                    onClick={() => { if (!done) setPicked((p) => ({ ...p, [index]: primitive.id })); }}
                    disabled={done}
                    className="rounded-full border px-3 py-1 text-xs font-medium"
                    style={{
                      borderColor: reveal ? "var(--ok)" : active ? "var(--bad)" : "var(--hairline-strong)",
                      color: reveal ? "var(--ok)" : active ? "var(--bad)" : "var(--fg-muted)",
                      background: reveal
                        ? "color-mix(in srgb, var(--ok) 12%, transparent)"
                        : "transparent",
                    }}
                  >
                    {primitive.label}
                  </button>
                );
              })}
              {done && (
                <span className="text-xs" style={{ color: correct ? "var(--ok)" : "var(--fg-muted)" }}>
                  {correct ? "Yes. " : "Not quite. "}
                  {question.why}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
