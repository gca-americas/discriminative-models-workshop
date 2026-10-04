/* An `assemble` task: the student builds one block of a real file by dragging
   pieces of code into its slots, instead of typing them.

   The task gives a template, the code with `{{slot}}` lines where pieces go,
   the pieces (right ones and decoys), and for each slot the pieces that belong
   in it. "Check and save" compares the slots with the answer: if they match,
   the assembled code is written to the file the same way an edit task saves
   it; if not, it says which pieces are missing or do not belong. A piece can
   also be clicked instead of dragged. Hints come one at a time, and the last
   step places the answer. */

import { useCallback, useEffect, useState, type DragEvent } from "react";

import { api, type Task } from "../lib/api";
import { highlightPython } from "./EditTask";
import { Inline } from "./Inline";

const CODE = "font-mono text-[0.8rem] leading-[1.6]";
const SLOT_LINE = /^(\s*)\{\{(\w+)\}\}\s*$/;      // a slot on a line of its own
const SLOT_INLINE = /\{\{(\w+)\}\}/;                // a slot inside a line: one piece

type Piece = { id: string; code: string; why?: string };
// label: what goes here. any: one piece, and any piece in `answer` is right.
type Slot = { answer: string[]; one?: boolean; any?: boolean; label?: string };

function assemble(template: string, placed: Record<string, string[]>, pieces: Piece[]): string {
  const byId = Object.fromEntries(pieces.map((piece) => [piece.id, piece]));
  return template
    .trimEnd()
    .split("\n")
    .flatMap((line) => {
      const slot = SLOT_LINE.exec(line);
      if (slot) {
        // A piece can span lines; each one takes the slot's indent.
        return (placed[slot[2]] ?? []).flatMap((id) =>
          (byId[id]?.code ?? "").split("\n").map((part) => slot[1] + part));
      }
      const inline = SLOT_INLINE.exec(line);
      if (inline) return [line.replace(inline[0], byId[(placed[inline[1]] ?? [])[0]]?.code ?? "")];
      return [line];
    })
    .join("\n");
}

export function AssembleTask({ slug, task, color }: { slug: string; task: Task; color: string }) {
  const template = task.template ?? "";
  const pieces: Piece[] = task.pieces ?? [];
  const slots: Record<string, Slot> = task.slots ?? {};
  const slotIds = Object.keys(slots);
  // The answer to place: the first right piece of an `any` slot.
  const answer = Object.fromEntries(slotIds.map((id) => [id, slots[id].any ? slots[id].answer.slice(0, 1) : slots[id].answer]));
  // Every right way to fill the slots, to recognise a block already saved.
  const answers = slotIds.reduce<Record<string, string[]>[]>((ways, id) =>
    ways.flatMap((way) => (slots[id].any ? slots[id].answer.map((piece) => [piece]) : [slots[id].answer])
      .map((ids) => ({ ...way, [id]: ids }))), [{}]);

  const [placed, setPlaced] = useState<Record<string, string[]>>(() => Object.fromEntries(slotIds.map((id) => [id, []])));
  const [target, setTarget] = useState(slotIds[0] ?? "");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState<"" | "save" | "reset">("");
  const [hint, setHint] = useState(0);
  const hints = task.hints ?? [];
  const steps = hints.length + 1;            // the last step places the answer

  // A block already saved correctly shows as assembled.
  useEffect(() => {
    api.codeRead(slug, task.id).then((block) => {
      const saved = answers.find((way) => block.ok && block.content?.trimEnd() === assemble(template, way, pieces));
      if (saved) {
        setPlaced(saved);
        setStatus({ ok: true, message: "Already assembled and saved." });
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, task.id]);

  const used = new Set(Object.values(placed).flat());
  const free = pieces.filter((piece) => !used.has(piece.id));

  const put = useCallback((id: string, slot: string) => {
    setStatus(null);
    setPlaced((current) => {
      const next = Object.fromEntries(Object.entries(current).map(([key, ids]) => [key, ids.filter((x) => x !== id)]));
      next[slot] = slots[slot]?.one || slots[slot]?.any ? [id] : [...(next[slot] ?? []), id];
      return next;
    });
  }, [slots]);

  const take = (id: string) => {
    setStatus(null);
    setPlaced((current) => Object.fromEntries(Object.entries(current).map(([key, ids]) => [key, ids.filter((x) => x !== id)])));
  };

  async function checkAndSave() {
    const byId = Object.fromEntries(pieces.map((piece) => [piece.id, piece]));
    const problems: string[] = [];
    let missing = 0;
    for (const id of slotIds) {
      const want = new Set(slots[id].answer);
      const got = placed[id] ?? [];
      const wrong = got.filter((x) => !want.has(x));
      for (const piece of wrong) {
        problems.push(byId[piece]?.why || `\`${byId[piece]?.code.trim()}\` does not belong here.`);
      }
      if (slots[id]?.any) {
        if (!got.length) missing += 1;
        continue;
      }
      // A one-piece slot holding a wrong piece is already explained above.
      if (!(slots[id]?.one && wrong.length)) missing += answer[id].filter((x) => !got.includes(x)).length;
    }
    if (missing) problems.push(missing === 1 ? "One piece is still missing." : `${missing} pieces are still missing.`);
    if (problems.length) {
      setStatus({ ok: false, message: problems.join(" ") });
      return;
    }
    setBusy("save");
    try {
      const block = await api.codeWrite(slug, task.id, assemble(template, placed, pieces));
      setStatus(block.ok
        ? { ok: true, message: `Correct. Saved to ${task.file}.` }
        : { ok: false, message: block.error ?? "could not save" });
    } catch {
      setStatus({ ok: false, message: "the workbench did not answer" });
    } finally {
      setBusy("");
    }
  }

  async function reset() {
    setBusy("reset");
    try {
      await api.codeReset(slug, task.id);
      setPlaced(Object.fromEntries(slotIds.map((id) => [id, []])));
      setHint(0);
      setStatus({ ok: true, message: "Back to how the workshop shipped it." });
    } finally {
      setBusy("");
    }
  }

  function nextHint() {
    if (hint >= hints.length) {
      setPlaced(answer);
      setStatus({ ok: true, message: "The answer is in place. Check and save to write it to the file." });
    }
    setHint((value) => Math.min(value + 1, steps));
  }

  const onDrop = (slot: string) => (event: DragEvent) => {
    event.preventDefault();
    const id = event.dataTransfer.getData("text/plain");
    if (id) put(id, slot);
  };

  const names = (task.symbols ?? []).join(", ");
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
        <div className="flex items-center gap-2 border-b px-4 py-2 text-xs"
             style={{ borderColor: "var(--hairline)", background: "var(--overlay)", color: "var(--fg-muted)" }}>
          <span className="font-mono" style={{ color: "var(--fg)" }}>{task.file}</span>
          {names && <span className="font-mono">· {names}</span>}
          <span className="ml-auto flex gap-2">
            <button type="button" onClick={nextHint} disabled={hint >= steps}
                    className="rounded-md border px-2.5 py-1 disabled:opacity-50"
                    style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-muted)" }}>
              {hint === 0 ? "Hint" : hint < hints.length ? "Another hint" : hint < steps ? "Show the answer" : "Answer in place"}
            </button>
            <button type="button" onClick={reset} disabled={busy !== ""}
                    className="rounded-md border px-2.5 py-1 disabled:opacity-50"
                    style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-muted)" }}>
              {busy === "reset" ? "Resetting…" : "Reset"}
            </button>
            <button type="button" onClick={checkAndSave} disabled={busy !== ""}
                    className="rounded-md px-3 py-1 font-semibold text-white disabled:opacity-50"
                    style={{ background: color }}>
              {busy === "save" ? "Saving…" : "Check and save"}
            </button>
          </span>
        </div>

        {task.context && (
          <div className="border-b" style={{ borderColor: "var(--hairline)", background: "var(--viewer-bg)" }}>
            <div className="px-4 pt-2 font-sans text-[0.7rem]" style={{ color: "var(--fg-faint)" }}>
              Already in the file, for reference
            </div>
            <pre className={`m-0 whitespace-pre-wrap px-4 pb-3 pt-1 ${CODE}`}
                 style={{ color: "var(--viewer-fg)", opacity: 0.65 }}>
              {highlightPython(task.context.trimEnd())}
            </pre>
          </div>
        )}
        <pre className={`quiet-scroll m-0 overflow-x-auto px-4 py-3 ${CODE}`}
             style={{ background: "var(--viewer-bg)", color: "var(--viewer-fg)" }}>
          {template.trimEnd().split("\n").map((line, index) => {
            const slot = SLOT_LINE.exec(line);
            const inline = slot ? null : SLOT_INLINE.exec(line);
            if (inline) {
              const id = inline[1];
              const before = line.slice(0, inline.index);
              const after = line.slice(inline.index + inline[0].length);
              const pieceId = (placed[id] ?? [])[0];
              const piece = pieces.find((p) => p.id === pieceId);
              const active = target === id;
              return (
                <div key={index}>
                  {highlightPython(before)}
                  <span
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={onDrop(id)}
                    onClick={() => (piece ? take(piece.id) : setTarget(id))}
                    title={`${slots[id]?.label ?? "a piece"}${piece ? " · click to take it out" : ""}`}
                    className="inline-block rounded-md border-2 border-dashed px-1.5 align-middle"
                    style={{
                      borderColor: active ? color : "var(--hairline-strong)",
                      background: `color-mix(in srgb, ${color} ${active ? 8 : 4}%, transparent)`,
                      minWidth: "8ch",
                    }}
                  >
                    {piece ? highlightPython(piece.code) : (
                      <span className="font-sans text-xs" style={{ color: "var(--fg-faint)" }}>
                        {slots[id]?.label ?? "drop here"}
                      </span>
                    )}
                  </span>
                  {highlightPython(after)}
                </div>
              );
            }
            if (!slot) return <div key={index}>{highlightPython(line) }{line ? "" : " "}</div>;
            const [, indent, id] = slot;
            const here = placed[id] ?? [];
            const active = target === id;
            return (
              <div
                key={index}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onDrop(id)}
                onClick={() => setTarget(id)}
                title={slots[id]?.label}
                className="my-1 rounded-md border-2 border-dashed px-2 py-1"
                style={{
                  marginLeft: `${indent.length}ch`,
                  borderColor: active ? color : "var(--hairline-strong)",
                  background: `color-mix(in srgb, ${color} ${active ? 8 : 4}%, transparent)`,
                  minHeight: "2.1em",
                }}
              >
                {here.length === 0 && (
                  <span className="font-sans text-xs" style={{ color: "var(--fg-faint)" }}>
                    Drag {slots[id]?.one || slots[id]?.any ? "a piece" : "pieces"} here{slots[id]?.label ? `: ${slots[id].label}` : ""}
                  </span>
                )}
                {here.map((pieceId) => {
                  const piece = pieces.find((p) => p.id === pieceId);
                  return (
                    <div key={pieceId} className="flex items-start gap-2">
                      <span className="flex-1 whitespace-pre">{highlightPython(piece?.code ?? "")}</span>
                      <button type="button" onClick={(event) => { event.stopPropagation(); take(pieceId); }}
                              className="font-sans text-xs" style={{ color: "var(--fg-faint)" }}
                              aria-label="Take this piece out">✕</button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </pre>

        <div className="border-t px-4 py-3" style={{ borderColor: "var(--hairline)", background: "var(--overlay)" }}>
          <div className="mb-2 text-xs" style={{ color: "var(--fg-faint)" }}>
            {free.length ? "Pieces: drag one into the slot, or click it. Some do not belong." : "Every piece is placed."}
          </div>
          <div className="flex flex-wrap gap-2">
            {free.map((piece) => (
              <button
                key={piece.id}
                type="button"
                draggable
                onDragStart={(event) => event.dataTransfer.setData("text/plain", piece.id)}
                onClick={() => put(piece.id, target)}
                className={`cursor-grab whitespace-pre rounded-lg border px-2.5 py-1 text-left ${CODE}`}
                style={{ borderColor: "var(--hairline-strong)", background: "var(--viewer-bg)", color: "var(--viewer-fg)" }}
              >
                {highlightPython(piece.code)}
              </button>
            ))}
          </div>
        </div>

        {status && (
          <div className="border-t px-4 py-2 text-xs"
               style={{ borderColor: "var(--hairline)", color: status.ok ? "var(--ok)" : "var(--bad)" }}>
            <Inline text={status.message} />
          </div>
        )}
      </div>
    </>
  );
}
