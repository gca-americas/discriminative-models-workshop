import { useCallback, useEffect, useRef, useState } from "react";

import { api, onRunEvent, type Exercise as ExerciseSpec, type Task } from "../lib/api";
import { AppPanel } from "./AppPanel";
import { InspectorPanel } from "./InspectorPanel";
import { FileExplorer } from "./FileExplorer";
import { EditTask } from "./EditTask";
import { AssembleTask } from "./AssembleTask";
import { SpellCardPicker } from "./SpellCardPicker";
import { CodePopup } from "./CodePopup";
import { Terminal } from "./Terminal";
import { HelpMe } from "./HelpMe";
import { StagedRun } from "./StagedRun";
import { Widget } from "../widgets";
import { Inline } from "./Inline";
import { Figure } from "../illustrations";

/* The exercise is the second half of every step: concepts above, practice below.

   The kinds of task:

     intent   the student says what they want, in their own words. If the
              request is right, the command runs on their machine. This is
              the default kind, because it's how they'll actually work.
     command  a command the student runs directly, for the few cases where
              there's nothing to work out.
     widget   something interactive to push on, rather than read.
     placeholder  space reserved for a diagram that is not drawn yet.
     files    a read-only look around the project, before anything is run.
     terminal a small real shell: pwd, ls, cd, cat, and running scripts.
     app      the student's app, running in its own process and embedded here
              through the workbench's proxy.
     console  a link to an external site, opened in a new tab.
     model-setup  choose the decision model; runs scripts/setup_model.sh.
     reflect  a question with no automatic answer.
     edit     one block of a real file the student fills in: hints, the answer, save, reset.
*/

function Checklist({ items }: { items: string[] }) {
  const [ticked, setTicked] = useState<Set<number>>(new Set());

  return (
    <ul className="mt-3 space-y-1.5">
      {items.map((item, index) => {
        const done = ticked.has(index);
        return (
          <li key={index}>
            <button
              type="button"
              onClick={() =>
                setTicked((previous) => {
                  const next = new Set(previous);
                  if (next.has(index)) next.delete(index);
                  else next.add(index);
                  return next;
                })
              }
              className="flex w-full items-start gap-2.5 rounded-md px-1.5 py-1 text-left text-sm"
              style={{ color: done ? "var(--fg-faint)" : "var(--fg-muted)" }}
            >
              <span
                className="mt-[3px] grid h-[15px] w-[15px] shrink-0 place-items-center rounded border text-[9px] leading-none"
                style={{
                  borderColor: done ? "var(--ok)" : "var(--hairline-strong)",
                  background: done ? "var(--ok)" : "transparent",
                  color: "var(--card)",
                }}
              >
                {done ? "✓" : ""}
              </span>
              <span className={done ? "line-through" : ""}><Inline text={item} /></span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Follows one run: the live stream, then the log file once it ends. */
function useRunStream() {
  const [lines, setLines] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [code, setCode] = useState<number | null>(null);
  const token = useRef<string | null>(null);

  useEffect(
    () =>
      onRunEvent((event) => {
        if (event.token !== token.current) return;
        if (event.type === "run.line") setLines((previous) => [...previous, event.line]);
        if (event.type === "run.done") {
          setState("done");
          setCode(event.code);
          // A buffering proxy can swallow stream lines. The log file can't.
          api
            .runStatus(event.token)
            .then((status) => setLines(status.log.split("\n").filter(Boolean)))
            .catch(() => {});
        }
      }),
    [],
  );

  // A proxy that buffers the stream (Cloud Shell's web preview can) may never
  // deliver run.done, so while a run is going, also ask for its status.
  useEffect(() => {
    if (state !== "running") return;
    const timer = setInterval(() => {
      const current = token.current;
      if (!current) return;
      api.runStatus(current).then((status) => {
        if (current !== token.current || status.state === "running") return;
        setState("done");
        setCode(status.code ?? null);
        setLines(status.log.split("\n").filter(Boolean));
      }).catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [state]);

  const begin = useCallback((fresh: string) => {
    token.current = fresh;
    setLines([]);
    setCode(null);
    setState("running");
  }, []);

  const resume = useCallback((fresh: string, log: string) => {
    token.current = fresh;
    setLines(log.split("\n").filter(Boolean));
    setCode(null);
    setState("running");
  }, []);

  const fail = useCallback((message: string) => {
    setState("done");
    setCode(1);
    setLines([message]);
  }, []);

  return { lines, state, code, begin, resume, fail };
}

function RunOutput({
  lines,
  state,
  code,
}: {
  lines: string[];
  state: string;
  code: number | null;
}) {
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Keep the newest line visible without moving the page around it.
    const panel = body.current;
    if (panel) panel.scrollTop = panel.scrollHeight;
  }, [lines.length]);

  if (!lines.length && state === "idle") return null;

  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[0.7rem]" style={{ color: "var(--fg-faint)" }}>
        running on your machine
      </div>
      <div
        ref={body}
        className="quiet-scroll max-h-72 overflow-y-auto rounded-2xl border px-4 py-3 font-mono text-[0.76rem] leading-relaxed whitespace-pre-wrap"
        style={{ background: "var(--viewer-bg)", color: "var(--viewer-fg)", borderColor: "var(--hairline)" }}
      >
        {lines.join("\n")}
      </div>
      {state === "done" && (
        <div
          className="mt-2 text-xs font-medium"
          style={{ color: code === 0 ? "var(--ok)" : "var(--bad)" }}
        >
          {code === 0 ? "Finished." : `Exited with code ${code}.`}
        </div>
      )}
    </div>
  );
}

function CommandLine({
  command,
  onEdit,
}: {
  command: string;
  onEdit?: (value: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-3 flex items-stretch gap-2">
      <div
        className="quiet-scroll flex-1 overflow-x-auto rounded-2xl border px-4 py-2.5 font-mono text-[0.8rem] leading-relaxed"
        style={{ background: "var(--viewer-bg)", color: "var(--viewer-fg)", borderColor: "var(--hairline)" }}
      >
        {onEdit ? (
          <input
            value={command}
            onChange={(event) => onEdit(event.target.value)}
            spellCheck={false}
            className="w-full bg-transparent font-mono outline-none"
            style={{ color: "var(--viewer-fg)" }}
          />
        ) : (
          <code className="whitespace-pre">{command}</code>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(command);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
        className="shrink-0 rounded-lg border px-3 text-xs font-medium"
        style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-muted)" }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function IntentTask({ slug, task, color }: { slug: string; task: Task; color: string }) {
  const [utterance, setUtterance] = useState("");
  const [verdict, setVerdict] = useState<{ ok: boolean; feedback: string; by: string } | null>(null);
  const [command, setCommand] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useRunStream();

  async function send() {
    if (!utterance.trim() || busy) return;
    setBusy(true);
    setVerdict(null);
    try {
      const response = await api.submitIntent(slug, task.id, utterance);
      setVerdict({ ok: response.ok, feedback: response.feedback, by: response.by });
      if (response.ok && response.token) {
        setCommand(response.command);
        run.begin(response.token);
      }
    } catch (error) {
      run.fail(String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {task.prompt && (
        <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
          <Inline text={task.prompt} />
        </p>
      )}

      <div className="mt-3">
        <textarea
          value={utterance}
          onChange={(event) => setUtterance(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send();
          }}
          rows={2}
          placeholder="Describe what you want, the way you'd ask an assistant…"
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
            onClick={send}
            disabled={busy || !utterance.trim()}
            className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: color }}
          >
            {busy ? "Checking…" : "Send"}
          </button>
          <HelpMe example={task.example} onUse={setUtterance} />
          <span className="text-xs" style={{ color: "var(--fg-faint)" }}>
            If the request is clear enough to act on, it runs.
          </span>
        </div>
      </div>

      {verdict && (
        <div
          className="mt-3 rounded-2xl border px-4 py-3 text-sm"
          style={{
            background: "var(--overlay)",
            borderColor: "var(--hairline)",
            color: "var(--fg-muted)",
          }}
        >
          <span
            className="mr-2 font-semibold"
            style={{ color: verdict.ok ? "var(--ok)" : "var(--bad)" }}
          >
            {verdict.ok ? "Running it." : "Not yet."}
          </span>
          {verdict.feedback}
        </div>
      )}

      {/* With stages declared, neither the command nor its output is the
          lesson, so both stay behind the panel. */}
      {task.stages?.length ? (
        run.state !== "idle" && (
          <StagedRun
            stages={task.stages}
            lines={run.lines}
            state={run.state === "done" ? (run.code === 0 ? "done" : "failed") : "running"}
            running="setting it up…"
            done="ready"
            failed="that did not finish — the log says why"
          />
        )
      ) : (
        <>
          {command && (
            <div className="mt-3">
              <div className="mb-1.5 text-[0.7rem]" style={{ color: "var(--fg-faint)" }}>
                What that turned into:
              </div>
              <CommandLine command={command} />
            </div>
          )}
          <RunOutput lines={run.lines} state={run.state} code={run.code} />
        </>
      )}
    </>
  );
}

function CommandTask({ slug, task, color }: { slug: string; task: Task; color: string }) {
  const [command, setCommand] = useState(task.command ?? "");
  const run = useRunStream();

  async function start() {
    try {
      const { token } = await api.startRun(slug, task.id);
      run.begin(token);
    } catch (error) {
      run.fail(String(error));
    }
  }

  return (
    <>
      {task.explain && (
        <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
          <Inline text={task.explain} />
        </p>
      )}
      <CommandLine command={command} onEdit={task.editable ? setCommand : undefined} />
      {task.editable && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--fg-faint)" }}>
          Edit this before you run it. The values are yours.
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={run.state === "running"}
          className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: color }}
        >
          {run.state === "running" ? "Running…" : "Run it"}
        </button>
        {task.note && (
          <span className="text-xs" style={{ color: "var(--fg-faint)" }}>
            {task.note}
          </span>
        )}
      </div>
      <RunOutput lines={run.lines} state={run.state} code={run.code} />
    </>
  );
}

function ConsoleTask({ task, color }: { task: Task; color: string }) {
  return (
    <>
      {task.explain && (
        <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
          <Inline text={task.explain} />
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={task.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium text-white"
          style={{ background: color }}
        >
          {task.linkLabel ?? "Open it"}
          <span aria-hidden>↗</span>
        </a>
      </div>
      <div className="mt-1.5 text-xs" style={{ color: "var(--fg-faint)" }}>
        Opens in a new tab. Return here when you're done.
      </div>
      {task.checklist && <Checklist items={task.checklist} />}
    </>
  );
}

/* Step 2: choose the decision model. The script checks each choice before it
   keeps it; a choice that fails is marked, and when Jev and DiffusionGemma
   have both failed, rehearsal mode is set up instead. */
const MODEL_OPTIONS: { id: string; label: string; detail: string }[] = [
  { id: "jev", label: "Jev (TypeSafe)", detail: "Hosted by TypeSafe. Needs a TypeSafe API key. No GPU needed." },
  {
    id: "gemma",
    label: "DiffusionGemma",
    detail: "Google's open model on a GPU VM in your Google Cloud project. Needs billing and GPU quota. About 15 minutes the first time, in the background.",
  },
  { id: "rehearsal", label: "Rehearsal", detail: "No model: a word list that speaks the same API. For trying the workshop out." },
];
const TYPESAFE_SIGN_UP = "https://console.typesafe.ai/login?returnTo=%2Fkeys";

function ModelSetupTask({ task, color }: { task: Task; color: string }) {
  const [model, setModel] = useState("jev");
  const [key, setKey] = useState("");
  const [failed, setFailed] = useState<string[]>([]);
  const running = useRef<string | null>(null);
  const run = useRunStream();

  const start = useCallback(async (choice: string, secret: string) => {
    running.current = choice;
    try {
      const { token } = await api.modelSetup(choice, secret);
      run.begin(token);
      setKey("");
    } catch (error) {
      run.fail(String(error));
    }
  }, [run.begin, run.fail]);

  // A DiffusionGemma setup keeps going on the server while the student moves
  // on; coming back picks up its output where it is.
  useEffect(() => {
    api.modelSetupStatus().then((status) => {
      if (status.token && status.state === "running" && status.model) {
        running.current = status.model;
        setModel(status.model);
        run.resume(status.token, status.log ?? "");
      }
    }).catch(() => {});
  }, [run.resume]);

  useEffect(() => {
    if (run.state !== "done" || running.current === null) return;
    const choice = running.current;
    running.current = null;
    if (run.code === 0 || choice === "rehearsal") return;
    const now = failed.includes(choice) ? failed : [...failed, choice];
    setFailed(now);
    if (now.includes("jev") && now.includes("gemma")) {
      setModel("rehearsal");
      start("rehearsal", "");
    } else {
      setModel(MODEL_OPTIONS.find((option) => !now.includes(option.id))?.id ?? "rehearsal");
    }
  }, [run.state, run.code, failed, start]);

  const both = failed.includes("jev") && failed.includes("gemma");
  return (
    <>
      {task.explain && (
        <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
          <Inline text={task.explain} />
        </p>
      )}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {MODEL_OPTIONS.map((option) => {
          const active = model === option.id;
          const didFail = failed.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setModel(option.id)}
              disabled={run.state === "running"}
              className="rounded-2xl border px-3.5 py-3 text-left disabled:opacity-60"
              style={{
                borderColor: active ? color : "var(--hairline)",
                background: active ? `color-mix(in srgb, ${color} 10%, transparent)` : "var(--overlay)",
              }}
            >
              <div className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                {option.label}
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--fg-muted)" }}>
                {option.detail}
              </div>
              {didFail && (
                <div className="mt-1.5 text-xs font-medium" style={{ color: "var(--bad)" }}>
                  Did not work here
                </div>
              )}
            </button>
          );
        })}
      </div>
      {model === "jev" && (
        <div className="mt-3 space-y-2">
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
            To get a key, sign up at the{" "}
            <a href={TYPESAFE_SIGN_UP} target="_blank" rel="noreferrer" style={{ color, fontWeight: 600 }}>
              TypeSafe console ↗
            </a>
            , then paste it here. The key is checked with one request before it is saved to <code>.env</code>.
          </p>
          <input
            type="password"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="TYPESAFE_API_KEY (leave empty to use the key already in .env)"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border px-3.5 py-2 font-mono text-sm outline-none"
            style={{ background: "var(--viewer-bg)", color: "var(--viewer-fg)", borderColor: "var(--hairline-strong)" }}
          />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => start(model, model === "jev" ? key : "")}
          disabled={run.state === "running"}
          className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          style={{ background: color }}
        >
          {run.state === "running" ? "Setting up…" : "Set up"}
        </button>
        {model === "gemma" && run.state === "running" && (
          <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
            This runs in the background, so you can move on. The model light at the top right turns green when it is ready.
          </span>
        )}
        {both && (
          <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Neither Jev nor DiffusionGemma works here, so the workshop uses rehearsal mode.
          </span>
        )}
      </div>
      <RunOutput lines={run.lines} state={run.state} code={run.code} />
    </>
  );
}

/* Above a terminal: things to look at or choose before running it. */
function TerminalExtras({ task, color }: { task: Task; color: string }) {
  const [code, setCode] = useState<string | null>(null);

  async function showFile() {
    if (!task.showFile) return;
    try {
      const file = await api.fileRead(task.showFile);
      setCode(file.lines ? file.lines.join("\n") : file.error ?? "could not read the file");
    } catch {
      setCode("could not read the file");
    }
  }

  return (
    <>
      {task.cards && <SpellCardPicker color={color} />}
      {task.showFile && (
        <button
          type="button"
          onClick={showFile}
          className="mt-3 rounded-lg border px-3 py-1.5 font-mono text-xs"
          style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-muted)" }}
        >
          View {task.showFile} ⤢
        </button>
      )}
      {code !== null && (
        <CodePopup title={task.showFile ?? ""} code={code} format="python" onClose={() => setCode(null)} />
      )}
    </>
  );
}

function ReflectTask({ task }: { task: Task }) {
  return (
    <>
      {task.prompt && (
        <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
          <Inline text={task.prompt} />
        </p>
      )}

      {task.linkTo && (
        <button
          type="button"
          onClick={() => {
            // Send the reader back to a panel further up rather than showing a
            // second copy of it.
            document
              .getElementById(`task-${task.linkTo}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          className="mt-3 inline-flex items-center gap-2 rounded-lg border px-3.5 py-1.5 text-sm"
          style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-muted)" }}
        >
          <span aria-hidden>↑</span>
          {task.linkLabel ?? "Back to the app above"}
        </button>
      )}

      {task.checklist && <Checklist items={task.checklist} />}
    </>
  );
}

function PlaceholderTask({ task, kind }: { task: Task; kind: string }) {
  return (
    <div
      className="mt-3 rounded-lg border border-dashed px-4 py-3 text-sm"
      style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-faint)" }}
    >
      <strong style={{ color: "var(--fg-muted)" }}>{kind} task</strong> — not built yet.
      {task.prompt && <div className="mt-1.5"><Inline text={task.prompt} /></div>}
      {task.file && <div className="mt-1.5 font-mono text-xs">{task.file}</div>}
    </div>
  );
}

export function Exercise({
  slug,
  exercise,
  color,
  plain = false,
}: {
  slug: string;
  exercise: ExerciseSpec;
  color: string;
  /** Inside a reading card: just the tasks, with no "Your turn" frame. */
  plain?: boolean;
}) {
  const tasks = (
    <ol className={plain ? "mt-4 space-y-5" : "mt-7 space-y-7"}>
      {exercise.tasks.map((task, index) => (
        <li key={task.id} id={`task-${task.id}`} className="flex gap-4">
          <span
            hidden={plain}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold"
            style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-muted)" }}
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[0.98rem] font-semibold">{task.title}</h3>
            {task.kind === "intent" && <IntentTask slug={slug} task={task} color={color} />}
            {task.kind === "command" && <CommandTask slug={slug} task={task} color={color} />}
            {task.kind === "widget" && (
              <>
                {task.explain && (
                  <p className="mt-2 text-sm" style={{ color: "var(--fg-muted)" }}>
                    <Inline text={task.explain} />
                  </p>
                )}
                <Widget id={task.widget ?? ""} />
              </>
            )}
            {task.kind === "placeholder" && (
              <div
                className="mt-3 grid min-h-28 place-items-center rounded-2xl border border-dashed px-4 text-center text-sm"
                style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-faint)" }}
              >
                {task.note ?? "diagram goes here"}
              </div>
            )}
            {task.kind === "files" && (
              <FileExplorer
                start={task.start}
                open={task.open}
                explain={task.explain}
                slug={slug}
                task={task}
                color={color}
              />
            )}
            {task.kind === "terminal" && (
              <>
                {(task.cards || task.showFile) && (
                  <TerminalExtras task={task} color={color} />
                )}
                <Terminal explain={task.explain} hint={task.hint} expect={task.expect} />
              </>
            )}
            {task.kind === "app" && (
              <AppPanel title={task.appTitle} explain={task.explain} color={color} mode={task.appMode} />
            )}
            {task.kind === "inspector" && (
              <InspectorPanel title={task.appTitle} explain={task.explain} color={color} />
            )}
            {task.kind === "console" && <ConsoleTask task={task} color={color} />}
            {task.kind === "model-setup" && <ModelSetupTask task={task} color={color} />}
            {task.kind === "reflect" && <ReflectTask task={task} />}
            {task.kind === "edit" && <EditTask slug={slug} task={task} color={color} />}
            {task.kind === "assemble" && <AssembleTask slug={slug} task={task} color={color} />}
            {task.kind === "draw" && <PlaceholderTask task={task} kind={task.kind} />}
          </div>
        </li>
      ))}
    </ol>
  );
  if (plain) return <div className="mt-2">{tasks}</div>;
  return (
    <section className="mt-14">
      <div
        className="rounded-3xl border p-6 sm:p-8"
        style={{ background: "var(--card)", borderColor: "var(--hairline)" }}
      >
        <div className="kicker" style={{ color }}>
          Your turn
        </div>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight">{exercise.title}</h2>
        {exercise.intro && (
          <p className="mt-2 max-w-2xl text-[0.95rem]" style={{ color: "var(--fg-muted)" }}>
            <Inline text={exercise.intro} />
          </p>
        )}
        {exercise.figure && (
          <div className="max-w-none">
            <Figure id={exercise.figure.id} caption={exercise.figure.caption ?? ""} />
          </div>
        )}

        {tasks}
      </div>
    </section>
  );
}
