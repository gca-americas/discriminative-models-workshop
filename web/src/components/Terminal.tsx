import { useEffect, useRef, useState } from "react";

import { api } from "../lib/api";
import { Inline } from "./Inline";

/* A terminal, as far as the student is concerned.

   Behind it is an allowlist rather than a shell -- pwd, ls, cd, cat, and
   running the app -- so exploring is safe and nothing destructive is
   reachable. Anything else answers "command not found", which is what a real
   shell would say and keeps the illusion honest.

   Starting the app here starts the same separate process the Start button
   does. The point of asking a student to type it is that the command is the
   thing they will type on any machine, forever. */

type Line = { kind: "prompt" | "out"; text: string };

export function Terminal({
  explain,
  hint,
  expect = [],
  onStarted,
}: {
  explain?: string;
  hint?: string;
  /** The commands this task is walking towards, in order. Help offers the
      first one that has not been run yet. */
  expect?: string[];
  onStarted?: () => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [cwd, setCwd] = useState("");
  const [label, setLabel] = useState("~");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [recall, setRecall] = useState(-1);

  const input = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLDivElement>(null);

  // What to offer next: the first expected command not yet typed. Matching on
  // history rather than counting keeps it right when someone explores first,
  // repeats a command, or does them out of order.
  const tidy = (line: string) => line.trim().replace(/\s+/g, " ");
  const done = new Set(history.map(tidy));
  const suggestion = expect.map(tidy).find((command) => !done.has(command));

  function offer() {
    if (!suggestion) return;
    setValue(suggestion);
    input.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    api
      .shell("pwd", "")
      .then((reply) => setLabel(reply.prompt))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Scroll this panel, not the page. scrollIntoView would walk every
    // scrollable ancestor and take the whole window back to the top.
    const panel = body.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [lines.length, busy]);

  async function submit() {
    const line = value.trim();
    if (busy) return;

    setValue("");
    setRecall(-1);
    if (line) setHistory((previous) => [line, ...previous].slice(0, 50));

    const echoed: Line[] = [{ kind: "prompt", text: `${label}$ ${line}` }];
    if (!line) {
      setLines((previous) => [...previous, ...echoed]);
      return;
    }

    // Show the command at once: on a slow connection the reply can take a
    // second or two, and a blank terminal looks like nothing was sent.
    setLines((previous) => [...previous, ...echoed]);
    setBusy(true);
    try {
      const reply = await api.shell(line, cwd);
      if (reply.cleared) {
        setLines([]);
      } else if (reply.output) {
        setLines((previous) => [...previous, { kind: "out", text: reply.output }]);
      }
      setCwd(reply.cwd);
      setLabel(reply.prompt);
      if (reply.started) onStarted?.();
    } catch {
      setLines((previous) => [...previous, { kind: "out", text: "the workbench did not answer" }]);
    } finally {
      setBusy(false);
      input.current?.focus({ preventScroll: true });
    }
  }

  function onKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
      return;
    }
    // Up and down walk the history, the way a shell does.
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (!history.length) return;
      event.preventDefault();
      const next =
        event.key === "ArrowUp"
          ? Math.min(recall + 1, history.length - 1)
          : Math.max(recall - 1, -1);
      setRecall(next);
      setValue(next === -1 ? "" : history[next]);
    }
  }

  return (
    <div className="mt-4">
      {explain && (
        <p className="mb-3 text-sm" style={{ color: "var(--fg-muted)" }}>
          <Inline text={explain} />
        </p>
      )}

      <div
        className="overflow-hidden rounded-3xl border"
        style={{ borderColor: "var(--hairline)", background: "var(--code-bg)" }}
      >
        <div
          className="flex items-center gap-2 border-b px-4 py-2"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <span className="flex gap-1.5">
            {["#ff5f57", "#febc2e", "#28c840"].map((colour) => (
              <span
                key={colour}
                className="inline-block h-[9px] w-[9px] rounded-full"
                style={{ background: colour, opacity: 0.85 }}
              />
            ))}
          </span>
          <span
            className="ml-1 font-mono text-[0.7rem]"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Terminal
          </span>
          {expect.length > 0 ? (
            <button
              type="button"
              onClick={offer}
              disabled={!suggestion}
              title={suggestion ? `Fills in: ${suggestion}` : "Nothing left to run here"}
              className="ml-auto rounded-full border px-2.5 py-[3px] font-mono text-[0.68rem] disabled:opacity-45"
              style={{
                borderColor: "rgba(255,255,255,0.16)",
                color: suggestion ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.4)",
              }}
            >
              {suggestion ? "Help me" : "All done"}
            </button>
          ) : (
            hint && (
              <span
                className="ml-auto font-mono text-[0.68rem]"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                try: {hint}
              </span>
            )
          )}
        </div>

        <div
          ref={body}
          className="quiet-scroll overflow-auto px-4 py-3 font-mono text-[0.76rem] leading-[1.6]"
          style={{ maxHeight: 300, minHeight: 140, color: "var(--code-fg)" }}
          onClick={() => input.current?.focus({ preventScroll: true })}
        >
          {lines.length === 0 && (
            <div style={{ color: "rgba(255,255,255,0.4)" }}>
              Type a command. <code className="inline-code on-dark">help</code> lists the ones this terminal knows.
            </div>
          )}

          {lines.map((line, index) => (
            <div
              key={index}
              style={{
                whiteSpace: "pre-wrap",
                color: line.kind === "prompt" ? "rgba(255,255,255,0.55)" : "var(--code-fg)",
              }}
            >
              {line.text}
            </div>
          ))}

          {busy && <Working />}

          <div className="flex items-baseline gap-2" style={{ display: busy ? "none" : undefined }}>
            <span style={{ color: busy ? "rgba(255,255,255,0.35)" : "var(--ok)" }}>
              {label}$
            </span>
            <input
              ref={input}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={onKey}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              className="flex-1 bg-transparent font-mono outline-none"
              style={{ color: "var(--code-fg)" }}
              aria-label="Terminal input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* While a command runs: a spinner and the seconds so far, so a slow reply
   never looks like a dead terminal. */
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function Working() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const handle = setInterval(() => setTick((value) => value + 1), 90);
    return () => clearInterval(handle);
  }, []);
  const seconds = (tick * 90) / 1000;
  return (
    <div style={{ color: "rgba(255,255,255,0.55)" }} aria-live="polite">
      <span style={{ color: "var(--ok)" }}>{FRAMES[tick % FRAMES.length]}</span>{" "}
      running{seconds >= 1 ? ` · ${seconds.toFixed(1)} s` : "…"}
    </div>
  );
}
