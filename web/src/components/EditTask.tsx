/* An `edit` task: the student changes one block of a real file.

   The block (a top-level symbol, such as REQUEST) is loaded from the file and
   edited in place: a textarea over a coloured copy of the same text, so it
   reads like code and types like a text box. Save writes it back once the
   server has checked it is still valid Python; Reset puts back the block as
   the workshop shipped it. Hints come one at a time, and the last one is the
   whole answer. */

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { api, type Task } from "../lib/api";
import { Inline } from "./Inline";

const PY_TOKEN =
  /(#.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')(\s*:)?|\b(\d+(?:\.\d+)?)\b|\b(True|False|None|def|return|import|from|with|as|if|else|for|in)\b|\b([A-Z][A-Z0-9_]{2,})\b|([{}[\](),:])/gm;

export function highlightPython(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const match of text.matchAll(PY_TOKEN)) {
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = n++;
    if (match[1]) {
      const todo = match[1].includes("TODO");
      out.push(
        <span key={key} style={{ color: todo ? "var(--accent)" : "var(--syn-punct)", fontStyle: "italic", fontWeight: todo ? 600 : 400 }}>
          {match[1]}
        </span>,
      );
    } else if (match[2] && match[3]) {
      out.push(<span key={key} style={{ color: "var(--syn-key)" }}>{match[2]}</span>, match[3]);
    } else if (match[2]) {
      out.push(<span key={key} style={{ color: "var(--syn-str)" }}>{match[2]}</span>);
    } else if (match[4]) {
      out.push(<span key={key} style={{ color: "var(--syn-num)" }}>{match[4]}</span>);
    } else if (match[5]) {
      out.push(<span key={key} style={{ color: "var(--syn-kw)" }}>{match[5]}</span>);
    } else if (match[6]) {
      out.push(<span key={key} style={{ color: "var(--syn-kw)", fontWeight: 600 }}>{match[6]}</span>);
    } else {
      out.push(<span key={key} style={{ color: "var(--syn-punct)" }}>{match[7]}</span>);
    }
    last = at + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const EDITOR_TEXT = "font-mono text-[0.8rem] leading-[1.6]";

export function EditTask({ slug, task, color }: { slug: string; task: Task; color: string }) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "reset">("");
  const [hint, setHint] = useState(0);

  const hints = task.hints ?? [];
  const names = (task.symbols ?? (task.symbol ? [task.symbol] : [])).join(", ");
  const steps = hints.length + (task.answer ? 1 : 0);   // the answer is the last hint
  const dirty = text !== saved;

  const load = useCallback(async () => {
    const block = await api.codeRead(slug, task.id);
    if (block.ok) {
      setText(block.content ?? "");
      setSaved(block.content ?? "");
    } else {
      setStatus({ ok: false, message: block.error ?? "could not read the file" });
    }
  }, [slug, task.id]);

  useEffect(() => { load().catch(() => setStatus({ ok: false, message: "the workbench did not answer" })); }, [load]);

  async function save() {
    setBusy("save");
    try {
      const block = await api.codeWrite(slug, task.id, text);
      if (block.ok) {
        setText(block.content ?? text);
        setSaved(block.content ?? text);
        setStatus({ ok: true, message: `Saved to ${task.file}. Python syntax OK.` });
      } else {
        setStatus({ ok: false, message: block.error ?? "could not save" });
      }
    } catch {
      setStatus({ ok: false, message: "the workbench did not answer" });
    } finally {
      setBusy("");
    }
  }

  async function reset() {
    setBusy("reset");
    try {
      const block = await api.codeReset(slug, task.id);
      if (block.ok) {
        setText(block.content ?? "");
        setSaved(block.content ?? "");
        setStatus({ ok: true, message: `${names || "The file"} ${names.includes(",") ? "are" : "is"} back to how the workshop shipped it.` });
      } else {
        setStatus({ ok: false, message: block.error ?? "could not reset" });
      }
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      {task.explain && (
        <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
          <Inline text={task.explain} />
        </p>
      )}

      {hint > 0 && (
        <div className="mt-3 space-y-2">
          {hints.slice(0, hint).map((line, index) => (
            <p key={index} className="rounded-xl border px-3.5 py-2 text-sm"
               style={{ borderColor: "var(--hairline)", background: "var(--overlay)", color: "var(--fg-muted)" }}>
              <span className="mr-1.5 font-semibold" style={{ color }}>Hint {index + 1}.</span>
              <Inline text={line} />
            </p>
          ))}
        </div>
      )}
      <div className="mt-3 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--hairline)" }}>
        <div
          className="flex items-center gap-2 border-b px-4 py-2 text-xs"
          style={{ borderColor: "var(--hairline)", background: "var(--overlay)", color: "var(--fg-muted)" }}
        >
          <span className="font-mono" style={{ color: "var(--fg)" }}>{task.file}</span>
          {names && <span className="font-mono">· {names}</span>}
          {dirty && <span style={{ color: "var(--amber, #f59e0b)" }}>· unsaved</span>}
          <span className="ml-auto flex gap-2">
            {steps > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (task.answer && hint >= hints.length) {
                    // The last step is the answer: it goes straight into the editor.
                    setText(task.answer.trimEnd());
                    setStatus({ ok: true, message: "The answer is in the editor. Save to write it to the file." });
                  }
                  setHint((value) => Math.min(value + 1, steps));
                }}
                disabled={hint >= steps}
                className="rounded-md border px-2.5 py-1 disabled:opacity-50"
                style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-muted)" }}
                title="Hints appear above the editor; the last step puts the answer in the editor"
              >
                {hint === 0 ? "Hint" : hint < hints.length ? "Another hint" : hint < steps ? "Show the answer" : "Answer in editor"}
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              disabled={busy !== ""}
              className="rounded-md border px-2.5 py-1 disabled:opacity-50"
              style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-muted)" }}
              title="Put back the block as the workshop shipped it"
            >
              {busy === "reset" ? "Resetting…" : "Reset"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy !== "" || !dirty}
              className="rounded-md px-3 py-1 font-semibold text-white disabled:opacity-50"
              style={{ background: color }}
            >
              {busy === "save" ? "Saving…" : "Save"}
            </button>
          </span>
        </div>
        <div className="quiet-scroll max-h-[32rem] overflow-auto" style={{ background: "var(--viewer-bg)" }}>
          <div className="grid min-w-max">
            <pre
              aria-hidden
              className={`m-0 whitespace-pre px-4 py-3 ${EDITOR_TEXT}`}
              style={{ gridArea: "1 / 1", color: "var(--viewer-fg)", pointerEvents: "none" }}
            >
              {highlightPython(text)}
              {"\n"}
            </pre>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "s") {
                  event.preventDefault();
                  if (dirty) save();
                } else if (event.key === "Tab") {
                  event.preventDefault();
                  const box = event.currentTarget;
                  const { selectionStart: from, selectionEnd: to } = box;
                  const next = text.slice(0, from) + "    " + text.slice(to);
                  setText(next);
                  requestAnimationFrame(() => { box.selectionStart = box.selectionEnd = from + 4; });
                }
              }}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label={`Edit ${names || task.file}`}
              className={`m-0 resize-none overflow-hidden whitespace-pre border-0 bg-transparent px-4 py-3 outline-none ${EDITOR_TEXT}`}
              style={{ gridArea: "1 / 1", color: "transparent", caretColor: "var(--viewer-fg)" }}
            />
          </div>
        </div>
        {status && (
          <div
            className="border-t px-4 py-2 text-xs"
            style={{ borderColor: "var(--hairline)", color: status.ok ? "var(--ok)" : "var(--bad)" }}
          >
            {status.message}
          </div>
        )}
      </div>

    </>
  );
}
