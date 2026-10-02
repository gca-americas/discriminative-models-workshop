/* The only place that knows the server exists. */

export interface StepCard {
  slug: string;
  order: number;
  title: string;
  kicker: string;
  part: string;
  minutes: number;
  color: string;
  summary: string;
  parts: PartChip[];
}

export interface PartChip {
  id: string;
  label: string;
  hasExercise: boolean;
  checkCount: number;
}

export interface AfterAction {
  action: "stop-app";
  label?: string;
  note?: string;
}

export interface PartFull extends PartChip {
  headline: string;
  body: string;
  exercise: Exercise | null;
  checks: CheckCard[];
  after: AfterAction | null;
}

/** One step of a staged run, and the log pattern that means it is finished. */
export interface Stage {
  title: string;
  note?: string;
  at?: string;
}

export interface Task {
  /** files: the step app/ should be at for this view (scripts/stage.py). */
  stage?: number;
  /** files: show only these paths in the tree. */
  only?: string[];
  /** files: mark what app/ gained since this stage (with `stage` as the later one). */
  compare?: number;
  /** files: a regular expression; matching lines are highlighted, with `highlightLabel` saying why. */
  highlight?: string;
  highlightLabel?: string;
  /** app: the mode the arena opens in. */
  appMode?: string;
  /** edit: the top-level symbol in `file` to edit, hints in order, and the answer. */
  symbol?: string;
  symbols?: string[];
  hints?: string[];
  answer?: string;
  kind:
    | "console"
    | "model-setup"
    | "edit"
    | "command"
    | "intent"
    | "app"
    | "inspector"
    | "files"
    | "terminal"
    | "widget"
    | "placeholder"
    | "reflect"
    | "edit"
    | "draw";
  id: string;
  title: string;
  url?: string;
  command?: string;
  file?: string;
  prompt?: string;
  explain?: string;
  note?: string;
  editable?: boolean;
  checklist?: string[];
  stamps?: string[];
  goal?: string;
  background?: boolean;
  appTitle?: string;
  linkTo?: string;
  linkLabel?: string;
  start?: string;
  open?: string;
  hint?: string;
  example?: string;
  stages?: Stage[];
  expect?: string[];
  widget?: string;
}

export interface Exercise {
  title: string;
  intro?: string;
  figure?: { id: string; caption?: string };
  tasks: Task[];
}

export interface CheckCard {
  id: string;
  label: string;
  hint: string;
}

export interface StepFull extends StepCard {
  partDetail: PartFull[];
}

export interface CheckResult {
  id: string;
  label: string;
  passed: boolean;
  command: string;
  detail: string;
  hint: string;
  refused: boolean;
  pending?: boolean;   // not failed: still being set up
}

export interface StageChange {
  path: string;
  status: "added" | "changed";
  lines: number[];      // for a changed file, the 1-based lines that differ
}

export interface CodeBlock {
  ok: boolean;
  error?: string;
  file?: string;
  content?: string;
  startLine?: number;
}

export interface FileNode {
  name: string;
  path: string;
  kind: "dir" | "file";
  size?: number;
  readable?: boolean;
  children?: FileNode[] | null;
}

export interface ShellReply {
  cwd: string;
  prompt: string;
  output: string;
  started: boolean;
  cleared: boolean;
}

export interface AppStatus {
  running: boolean;
  managed: boolean;
  port: number;
  url: string;
  log: string | null;
  detail?: string;
}

export interface Env {
  jev: string;          // "live" | "rehearsal" | "no key" | ...
  jevKey: boolean;
  modelReady: boolean;  // checked and answering
  modelSetup: string;   // the model step 2 is setting up now, or ""
  rehearsal: boolean;
  gemini: string;       // "vertex" | "api key" | "no key"
  geminiReady: boolean;
  model: string;
  project: string;
  envFile: string;
}

export interface CoursePayload {
  course: {
    title: string;
    subtitle?: string;
    tagline?: string;
    thesis?: string;
    credit?: string;
    parts?: { id: string; title: string; color: string }[];
  };
  steps: StepCard[];
  totalMinutes: number;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init);
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return response.json() as Promise<T>;
}

export const api = {
  course: () => json<CoursePayload>("/api/course"),
  step: (slug: string) => json<StepFull>(`/api/steps/${slug}`),
  env: (refresh = false) => json<Env>(`/api/env${refresh ? "?refresh=true" : ""}`),
  check: (slug: string, part = "") =>
    json<{ results: CheckResult[]; passed: boolean; env: Env }>(
      `/api/check/${slug}${part ? `?part=${encodeURIComponent(part)}` : ""}`,
      { method: "POST" },
    ),
  codeRead: (slug: string, taskId: string) =>
    json<CodeBlock>(`/api/code/${slug}/${taskId}`),
  codeWrite: (slug: string, taskId: string, content: string) =>
    json<CodeBlock>(`/api/code/${slug}/${taskId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    }),
  codeReset: (slug: string, taskId: string) =>
    json<CodeBlock>(`/api/code/${slug}/${taskId}/reset`, { method: "POST" }),
  stageChanges: (since: number, to: number) =>
    json<{ files: StageChange[] }>(`/api/stage/changes?since=${since}&to=${to}`),
  modelCheck: () => json<{ env: Env; message: string }>("/api/model-check", { method: "POST" }),
  modelSetupStatus: () =>
    json<{ token: string | null; state?: string; model?: string; log?: string }>("/api/model-setup"),
  modelSetup: (model: string, key: string) =>
    json<{ token: string; command: string }>("/api/model-setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, key }),
    }),
  startRun: (slug: string, taskId: string) =>
    json<{ token: string }>(`/api/run/${slug}/${taskId}`, { method: "POST" }),
  submitIntent: (slug: string, taskId: string, utterance: string) =>
    json<{ ok: boolean; by: string; feedback: string; token: string | null; command: string | null }>(
      `/api/intent/${slug}/${taskId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utterance }),
      },
    ),
  fileTree: (start = "", depth = 3) =>
    json<{ root: string; display: string; entries: FileNode[] }>(
      `/api/files/tree?start=${encodeURIComponent(start)}&depth=${depth}`,
    ),
  fileRead: (path: string) =>
    json<{ path: string; language?: string; lines?: string[]; error?: string }>(
      `/api/files/read?path=${encodeURIComponent(path)}`,
    ),
  shell: (line: string, cwd: string) =>
    json<ShellReply>("/api/shell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line, cwd }),
    }),
  appStatus: () => json<AppStatus>("/api/app/status"),
  stageStatus: () => json<StageStatus>("/api/stage"),
  stageApply: (number: number) =>
    json<StageStatus & { ok: boolean; output: string }>("/api/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number }),
    }),
  inspectorStatus: () => json<InspectorStatus>("/api/inspector"),
  appStart: () => json<AppStatus>("/api/app/start", { method: "POST" }),
  appStop: () => json<AppStatus>("/api/app/stop", { method: "POST" }),
  appLog: () => json<{ log: string }>("/api/app/log"),
  runStatus: (token: string) =>
    json<{ token: string; state: string; code: number | null; log: string }>(
      `/api/run/${token}`,
    ),
};

type RunEvent =
  | { type: "run.start"; token: string; command: string }
  | { type: "run.line"; token: string; line: string }
  | { type: "run.done"; token: string; code: number };

/** One EventSource for the whole page, shared by every run panel. */
let source: EventSource | null = null;
const listeners = new Set<(event: RunEvent) => void>();

export function onRunEvent(listener: (event: RunEvent) => void): () => void {
  listeners.add(listener);
  if (!source) {
    source = new EventSource("/api/events");
    source.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as RunEvent;
        listeners.forEach((fn) => fn(event));
      } catch {
        /* keepalive padding and comments arrive here; ignore them */
      }
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && source) {
      source.close();
      source = null;
    }
  };
}

export interface InspectorStatus {
  up: boolean;
  url: string;
  app: string;
  error: string;
}

export interface StageStatus {
  stage: number | null;
  stages: { number: number; name: string }[];
}
