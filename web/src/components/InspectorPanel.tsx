import { useEffect, useState } from "react";

import { api, type InspectorStatus } from "../lib/api";
import { Inline } from "./Inline";

/* ADK web (the ADK development UI), embedded.

   The workbench server mounts it at /inspector, so the frame is same-origin
   and needs no second port (which matters in Cloud Shell). It loads the same
   workflow as `python3 scripts/arena.py`: agents/arena/agent.py. Collapsed
   until asked for, because the UI is a large bundle. */

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className="inline-block h-[7px] w-[7px] rounded-full"
      style={{ background: on ? "var(--ok)" : "var(--fg-faint)" }}
    />
  );
}

export function InspectorPanel({ title, explain, color }: {
  title?: string;
  explain?: string;
  color: string;
}) {
  const [status, setStatus] = useState<InspectorStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    api.inspectorStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const up = status?.up ?? false;
  const url = status?.url ?? "/inspector/dev-ui/?app=arena";

  return (
    <div className="mt-4">
      {explain && (
        <p className="mb-3 whitespace-pre-line text-sm" style={{ color: "var(--fg-muted)" }}>
          <Inline text={explain} />
        </p>
      )}

      <div
        className="overflow-hidden rounded-3xl border"
        style={{ borderColor: "var(--hairline)", background: "var(--card)" }}
      >
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5"
          style={{ borderBottom: open ? "1px solid var(--hairline)" : "none" }}
        >
          <Dot on={up} />
          <span className="text-sm font-medium">{title || "ADK web"}</span>
          <span className="font-mono text-[0.7rem]" style={{ color: "var(--fg-faint)" }}>
            {status === null
              ? "checking…"
              : up
                ? `app ${status.app} · mounted at /inspector`
                : `unavailable${status.error ? ` · ${status.error}` : ""}`}
          </span>

          <div className="ml-auto flex items-center gap-2">
            {open && up && (
              <>
                <button
                  type="button"
                  onClick={() => setNonce((value) => value + 1)}
                  className="rounded-lg border px-2.5 py-1 text-xs"
                  style={{ borderColor: "var(--hairline)", color: "var(--fg-muted)" }}
                >
                  Reload
                </button>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border px-2.5 py-1 text-xs"
                  style={{ borderColor: "var(--hairline)", color: "var(--fg-muted)" }}
                >
                  Open in a new tab
                </a>
              </>
            )}
            <button
              type="button"
              disabled={!up}
              onClick={() => setOpen((value) => !value)}
              className="rounded-lg px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
              style={{ background: color }}
            >
              {open ? "Hide ADK web" : "Open ADK web"}
            </button>
          </div>
        </div>

        {open && up && (
          <iframe
            key={nonce}
            src={url}
            title="ADK web"
            className="block w-full"
            style={{ height: 780, border: 0, background: "#fff" }}
          />
        )}
      </div>
    </div>
  );
}
