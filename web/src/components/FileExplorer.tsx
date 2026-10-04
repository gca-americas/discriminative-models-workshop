import { useCallback, useEffect, useRef, useState } from "react";

import { api, type FileNode, type StageChange, type Task } from "../lib/api";
import { HelpMe } from "./HelpMe";
import { Inline } from "./Inline";

/* A read-only look around the project.

   Reading comes before running: a student should be able to see what the app
   is made of before being asked to start it. Editing arrives later in the
   course; for now this only opens files. */

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className="inline-block w-3 text-[9px] transition-transform"
      style={{ color: "var(--fg-faint)", transform: open ? "rotate(90deg)" : "none" }}
    >
      ▶
    </span>
  );
}

function Row({
  node,
  depth,
  openDirs,
  toggle,
  selected,
  select,
  marks,
}: {
  node: FileNode;
  depth: number;
  openDirs: Set<string>;
  toggle: (path: string) => void;
  selected: string;
  select: (path: string) => void;
  marks: Record<string, StageChange>;
}) {
  const isOpen = openDirs.has(node.path);
  const isSelected = node.path === selected;
  const mark = marks[node.path];
  const holdsMark = node.kind === "dir" && Object.keys(marks).some((path) => path.startsWith(node.path + "/"));

  return (
    <>
      <button
        type="button"
        onClick={() => (node.kind === "dir" ? toggle(node.path) : select(node.path))}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-[3px] text-left font-mono text-[0.74rem]"
        style={{
          paddingLeft: 8 + depth * 13,
          background: isSelected ? "var(--overlay)" : "transparent",
          color: mark ? "var(--accent)" : isSelected ? "var(--fg)" : "var(--fg-muted)",
        }}
      >
        {node.kind === "dir" ? <Chevron open={isOpen} /> : <span className="w-3" />}
        <span className="truncate" style={{ fontWeight: mark ? 600 : 400 }}>
          {node.name}
          {node.kind === "dir" ? "/" : ""}
        </span>
        {mark && (
          <span
            className="ml-auto shrink-0 rounded px-1 font-sans text-[0.6rem] font-semibold uppercase tracking-wide"
            style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
          >
            {mark.status === "added" ? "new" : "changed"}
          </span>
        )}
        {holdsMark && !isOpen && (
          <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
        )}
      </button>

      {node.kind === "dir" &&
        isOpen &&
        (node.children ?? []).map((child) => (
          <Row
            key={child.path}
            node={child}
            depth={depth + 1}
            openDirs={openDirs}
            toggle={toggle}
            selected={selected}
            select={select}
            marks={marks}
          />
        ))}
    </>
  );
}

export function FileExplorer({
  start = "",
  open = "",
  explain,
  slug,
  task,
  color,
}: {
  start?: string;
  open?: string;
  explain?: string;
  /** When the task carries an `expect`, a request box appears above the tree
      and the file is re-read once the command it triggers has run. */
  slug?: string;
  task?: Task;
  color?: string;
}) {
  const [entries, setEntries] = useState<FileNode[]>([]);
  const [root, setRoot] = useState("");
  const [where, setWhere] = useState("");
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState("");
  const [lines, setLines] = useState<string[] | null>(null);
  const [problem, setProblem] = useState("");
  const [utterance, setUtterance] = useState("");
  const [verdict, setVerdict] = useState<{ ok: boolean; feedback: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [changed, setChanged] = useState<[number, number] | null>(null);
  const code = useRef<HTMLDivElement>(null);
  const [reloads, setReloads] = useState(0);        // bumps after a stage reset
  const [marks, setMarks] = useState<Record<string, StageChange>>({});
  const pattern = (() => {
    try { return task?.highlight ? new RegExp(task.highlight) : null; } catch { return null; }
  })();

  // What this step added to app/, compared with an earlier stage.
  useEffect(() => {
    if (task?.compare === undefined || task.stage === undefined) return;
    api
      .stageChanges(task.compare, task.stage)
      .then((payload) => {
        setMarks(Object.fromEntries(payload.files.map((change) => [change.path, change])));
        setOpenDirs((previous) => {
          const next = new Set(previous);
          for (const change of payload.files) {
            const parts = change.path.split("/").slice(0, -1);
            parts.forEach((_, index) => next.add(parts.slice(0, index + 1).join("/")));
          }
          return next;
        });
      })
      .catch(() => setMarks({}));
  }, [task?.compare, task?.stage, reloads]);

  useEffect(() => {
    api
      .fileTree(start, 4)
      .then((payload) => {
        setEntries(task?.only?.length ? prune(payload.entries, task.only) : payload.entries);
        setRoot(payload.root);
        setWhere(payload.display);
        // Open the folders on the way to the file a step wants shown.
        if (open) {
          const parts = open.split("/").slice(0, -1);
          const paths = parts.map((_, index) => parts.slice(0, index + 1).join("/"));
          setOpenDirs(new Set(paths));
        }
      })
      .catch(() => setProblem("could not read the project"));
  }, [start, open, reloads, task?.only]);

  const show = useCallback(async (path: string, keepHighlight = false) => {
    setSelected(path);
    setLines(null);
    setProblem("");
    if (!keepHighlight) setChanged(null);
    try {
      const file = await api.fileRead(path);
      if (file.error) {
        setProblem(file.error);
        return null;
      }
      setLines(file.lines ?? null);
      return file.lines ?? null;
    } catch {
      setProblem("could not read that file");
      return null;
    }
  }, []);

  /** The band of lines that differ, found from both ends. A step rewrites one
      contiguous section, so this is exact rather than a guess. */
  function bandBetween(before: string[], after: string[]): [number, number] | null {
    let top = 0;
    while (top < before.length && top < after.length && before[top] === after[top]) top += 1;
    let fromEnd = 0;
    while (
      fromEnd < before.length - top &&
      fromEnd < after.length - top &&
      before[before.length - 1 - fromEnd] === after[after.length - 1 - fromEnd]
    ) {
      fromEnd += 1;
    }
    const last = after.length - 1 - fromEnd;
    return last >= top ? [top, last] : null;
  }

  useEffect(() => {
    if (open) show(open);
  }, [open, show, reloads]);

  async function ask() {
    if (!slug || !task || !utterance.trim() || asking) return;
    setAsking(true);
    setVerdict(null);
    setChanged(null);
    const before = lines;
    try {
      const response = await api.submitIntent(slug, task.id, utterance);
      setVerdict({ ok: response.ok, feedback: response.feedback });
      if (response.ok && response.token) {
        // Let the command finish, then show what it did to the file.
        await new Promise((resolve) => setTimeout(resolve, 2200));
        const target = selected || open;
        if (target) {
          const after = await show(target, true);
          if (before && after) setChanged(bandBetween(before, after));
        }
      }
    } catch {
      setVerdict({ ok: false, feedback: "the workbench did not answer" });
    } finally {
      setAsking(false);
    }
  }

  useEffect(() => {
    if (!changed || !code.current) return;
    // Scroll this pane, never the page.
    const lineHeight = code.current.scrollHeight / Math.max(1, lines?.length ?? 1);
    code.current.scrollTop = Math.max(0, changed[0] * lineHeight - 40);
  }, [changed, lines]);

  function toggle(path: string) {
    setOpenDirs((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  return (
    <div className="mt-4">
      {explain && (
        <p className="mb-3 text-sm" style={{ color: "var(--fg-muted)" }}>
          <Inline text={explain} />
        </p>
      )}

      {task?.stage !== undefined && (
        <StageBar step={task.stage} color={color} onReset={() => setReloads((value) => value + 1)} />
      )}

      {task?.expect && slug && (
        <div className="mb-3">
          <textarea
            value={utterance}
            onChange={(event) => setUtterance(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) ask();
            }}
            rows={2}
            placeholder="Describe the change you want, the way you'd ask an assistant…"
            className="w-full resize-y rounded-lg border px-3.5 py-2.5 text-sm outline-none"
            style={{
              background: "var(--overlay)",
              borderColor: "var(--hairline-strong)",
              color: "var(--fg)",
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={ask}
              disabled={asking || !utterance.trim()}
              className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              style={{ background: color ?? "var(--accent)" }}
            >
              {asking ? "Working…" : "Send"}
            </button>
            <HelpMe example={task.example} onUse={setUtterance} />
            <span className="text-xs" style={{ color: "var(--fg-faint)" }}>
              The file below changes if the request is clear enough to act on.
            </span>
          </div>

          {verdict && (
            <p
              className="mt-2 text-sm"
              style={{ color: verdict.ok ? "var(--fg-muted)" : "var(--bad)" }}
            >
              {verdict.ok ? "" : "Not yet. "}
              {verdict.feedback}
            </p>
          )}

          {asking && (
            <div className="working-bar mt-2 h-[3px] w-full rounded-full" aria-hidden />
          )}

          {changed && !asking && (
            <p className="mt-2 text-sm" style={{ color: "var(--accent)" }}>
              {changed[1] - changed[0] + 1} lines changed, highlighted below.
            </p>
          )}
        </div>
      )}

      <div
        className="overflow-hidden rounded-3xl border"
        style={{ borderColor: "var(--hairline)", background: "var(--card)" }}
      >
        <div
          className="flex items-center gap-3 border-b px-4 py-2.5"
          style={{ borderColor: "var(--hairline)" }}
        >
          <span className="kicker" style={{ color: "var(--fg-faint)" }}>
            Files
          </span>
          <span className="font-mono text-[0.72rem]" style={{ color: "var(--fg)" }}>
            {where || "~"}
          </span>
          <span className="font-mono text-[0.72rem]" style={{ color: "var(--fg-faint)" }}>
            {selected
              ? `/ ${root && selected.startsWith(root + "/") ? selected.slice(root.length + 1) : selected}`
              : "· select a file"}
          </span>
          <span className="ml-auto text-[0.68rem]" style={{ color: "var(--fg-faint)" }}>
            read only
          </span>
        </div>

        {(Object.keys(marks).length > 0 || task?.highlightLabel) && (
          <div className="border-b px-4 py-2 text-xs" style={{ borderColor: "var(--hairline)", color: "var(--fg-muted)" }}>
            {Object.keys(marks).length > 0 && (
              <>
                Compared with {modeName(task?.compare ?? null)}: files this step adds are marked{" "}
                <span className="font-semibold" style={{ color: "var(--accent)" }}>NEW</span>
                {Object.values(marks).some((m) => m.status === "changed") && <>, and changed lines are highlighted</>}.{" "}
              </>
            )}
            {task?.highlightLabel && (
              <span>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm align-middle"
                      style={{ background: "color-mix(in srgb, var(--accent) 30%, transparent)", boxShadow: "inset 2px 0 0 var(--accent)" }} />
                {task.highlightLabel}
              </span>
            )}
          </div>
        )}
        <div className="grid" style={{ gridTemplateColumns: "minmax(9rem, 13rem) 1fr" }}>
          <div
            className="quiet-scroll overflow-auto border-r py-2"
            style={{ borderColor: "var(--hairline)", maxHeight: 840 }}
          >
            {root && (
              <div
                className="mb-1 flex items-center gap-1.5 px-2 py-[3px] font-mono text-[0.74rem]"
                style={{ color: "var(--fg)" }}
                title={where}
              >
                <span className="w-3 text-[9px]" style={{ color: "var(--fg-faint)" }}>
                  ▾
                </span>
                <span className="truncate">{root.split("/").pop()}/</span>
              </div>
            )}
            {entries.map((node) => (
              <Row
                key={node.path}
                node={node}
                depth={root ? 1 : 0}
                openDirs={openDirs}
                toggle={toggle}
                selected={selected}
                select={show}
                marks={marks}
              />
            ))}
          </div>

          <div
            ref={code}
            className="quiet-scroll overflow-auto"
            style={{ maxHeight: 840, background: "var(--viewer-bg)" }}
          >
            {problem && marks[selected]?.status === "added" ? (
              <p className="p-4 text-sm" style={{ color: "var(--fg-muted)" }}>
                This file is not in the game yet. Update the game above to add it.
              </p>
            ) : problem ? (
              <p className="p-4 font-mono text-[0.75rem]" style={{ color: "var(--bad)" }}>
                {problem}
              </p>
            ) : lines ? (
              <pre className="m-0 p-3 font-mono text-[0.73rem] leading-[1.55]">
                {marks[selected]?.status === "added" && (
                  <div className="mb-2 rounded-md px-2 py-1 font-sans text-[0.72rem]"
                       style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}>
                    New in this step. Manual mode does not have this file.
                  </div>
                )}
                {lines.map((line, index) => {
                  const lit = (changed !== null && index >= changed[0] && index <= changed[1])
                    || (marks[selected]?.lines.includes(index + 1) ?? false);
                  const picked = pattern?.test(line) ?? false;
                  return (
                    <div
                      key={index}
                      className={`flex ${lit ? "line-changed" : ""}`}
                      style={picked ? {
                        background: "color-mix(in srgb, var(--accent) 16%, transparent)",
                        boxShadow: "inset 3px 0 0 var(--accent)",
                      } : undefined}
                    >
                      <span
                        className="w-9 shrink-0 pr-3 text-right select-none"
                        style={{
                          color: lit ? "var(--accent)" : "var(--fg-faint)",
                          opacity: lit ? 0.9 : 0.55,
                        }}
                      >
                        {index + 1}
                      </span>
                      <span style={{ color: "var(--viewer-fg)", whiteSpace: "pre-wrap" }}>
                        {line || " "}
                      </span>
                    </div>
                  );
                })}
              </pre>
            ) : (
              <p
                className="p-4 font-mono text-[0.75rem]"
                style={{ color: "var(--fg-faint)" }}
              >
                Pick a file on the left.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* A step can show just the files it is about. Folders stay only when
   something inside them is kept. */
function prune(nodes: FileNode[], only: string[]): FileNode[] {
  const kept: FileNode[] = [];
  for (const node of nodes) {
    if (node.kind === "file") {
      if (only.includes(node.path)) kept.push(node);
    } else {
      const children = prune(node.children ?? [], only);
      if (children.length) kept.push({ ...node, children });
    }
  }
  return kept;
}

/* Which step app/ is built up to, and a way back. The arena grows a stage at
   a time (scripts/stage.py); someone who returns to step 3 from step 6 would
   otherwise read step 6's code here. */
const STAGE_MODES: Record<number, string> = {
  3: "manual mode",
  5: "Discriminative model mode",
  6: "workflow mode",
};
const modeName = (stage: number | null) => (stage !== null && STAGE_MODES[stage]) || `step ${stage ?? "?"}`;

function StageBar({ step, color, onReset }: { step: number; color?: string; onReset: () => void }) {
  const [at, setAt] = useState<number | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    api.stageStatus().then((status) => setAt(status.stage)).catch(() => setAt(undefined));
  }, []);

  async function reset() {
    setBusy(true);
    setNote("");
    try {
      const result = await api.stageApply(step);
      setAt(result.stage);
      const last = result.output.split("\n").filter(Boolean).pop() ?? "";
      setNote(result.ok ? `The game is in ${modeName(step)}. ${last}` : "could not change it: " + last);
      onReset();
    } catch {
      setNote("the workbench did not answer");
    } finally {
      setBusy(false);
    }
  }

  if (at === undefined) return null;
  const matches = at === step;
  const verb = at !== null && at < step ? "Update" : "Reset";
  const message = note || (matches ? "" : `The game is in ${modeName(at)}. This step uses ${modeName(step)}.`);
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3.5 py-2 text-sm"
      style={{
        borderColor: matches ? "var(--hairline)" : "color-mix(in srgb, var(--amber, #f59e0b) 55%, transparent)",
        background: matches ? "var(--overlay)" : "color-mix(in srgb, var(--amber, #f59e0b) 10%, transparent)",
        color: "var(--fg-muted)",
      }}
    >
      {message && <span>{message}</span>}
      <button
        type="button"
        onClick={reset}
        disabled={busy}
        className={`${message ? "ml-auto " : ""}rounded-lg px-3 py-1 text-xs font-semibold disabled:opacity-50`}
        style={matches
          ? { border: "1px solid var(--hairline-strong)", color: "var(--fg-muted)" }
          : { background: color || "var(--accent)", color: "#fff" }}
      >
        {busy ? "Working…" : `${verb} game to ${modeName(step)}`}
      </button>
    </div>
  );
}
