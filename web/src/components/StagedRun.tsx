import { useState } from "react";

import type { Stage } from "../lib/api";
import { StagePipeline, stageFromLog } from "./StagePipeline";

/* What a running command looks like when the output is not the lesson.

   Installing a library prints pages of pip noise and none of it teaches
   anything. So the panel shows the few things that are actually happening and
   keeps the log behind a button -- available the moment it matters, which is
   when something failed. */

export function StagedRun({ stages, lines, state, running, done, failed }: {
  stages: Stage[];
  lines: string[];
  state: "running" | "done" | "failed";
  running: string;
  done: string;
  failed: string;
}) {
  const [showLog, setShowLog] = useState(false);

  const reached = stageFromLog(stages, lines);
  const current = state === "done" ? stages.length : reached;

  return (
    <div className="mt-4 rounded-2xl border p-5"
         style={{ background: "var(--overlay)", borderColor: "var(--hairline)" }}>
      <StagePipeline
        stages={stages}
        current={current}
        failed={state === "failed"}
        label={state === "failed" ? failed : state === "done" ? done : running}
      />

      <p className="mt-3 text-center text-xs"
         style={{ color: state === "failed" ? "var(--bad)" : "var(--fg-muted)" }}>
        {state === "failed" ? failed : state === "done" ? done : running}
      </p>

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          onClick={() => setShowLog((value) => !value)}
          className="rounded-full border px-3 py-1 text-xs"
          style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-muted)" }}
        >
          {showLog ? "Hide log" : "Show log"}
        </button>
      </div>

      {showLog && (
        <div
          className="quiet-scroll mt-3 max-h-64 overflow-y-auto rounded-xl border px-4 py-3 font-mono text-[0.74rem] leading-relaxed whitespace-pre-wrap"
          style={{ background: "var(--viewer-bg)", color: "var(--viewer-fg)",
                   borderColor: "var(--hairline)" }}
        >
          {lines.length ? lines.join("\n") : "waiting for output…"}
        </div>
      )}
    </div>
  );
}
