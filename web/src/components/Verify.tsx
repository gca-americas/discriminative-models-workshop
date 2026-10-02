import { useState } from "react";

import { api, type AfterAction, type CheckCard, type CheckResult } from "../lib/api";
import { Inline } from "./Inline";

/* The verify panel never asks the student whether they did the thing.

   It runs a read-only command on their real machine and shows both the
   answer and the command that produced it -- so a check is also a lesson in
   how you would have found this out without a workbench. */

function Row({ card, result }: { card: CheckCard; result?: CheckResult }) {
  const [open, setOpen] = useState(false);
  const passed = result?.passed ?? false;
  const pending = result?.pending ?? false;
  const known = result !== undefined && !pending;

  return (
    <li className="border-b last:border-b-0" style={{ borderColor: "var(--hairline)" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-3 py-3 text-left"
      >
        <span
          className="mt-[3px] grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full text-[10px] leading-none text-white"
          style={{
            background: !known ? (pending ? "transparent" : "var(--hairline-strong)") : passed ? "var(--ok)" : "transparent",
            border: pending ? "1.5px solid var(--amber, #f59e0b)" : known && !passed ? "1.5px solid var(--bad)" : "none",
            color: known && !passed ? "var(--bad)" : "#fff",
          }}
        >
          {!known ? "" : passed ? "✓" : "✕"}
        </span>

        <span className="min-w-0 flex-1">
          <span className="text-[0.93rem]" style={{ color: known && !passed ? "var(--fg)" : "var(--fg-muted)" }}>
            {card.label}
          </span>
          {(pending || (known && !passed)) && (result?.hint || card.hint) && (
            <span className="mt-1 block text-sm" style={{ color: "var(--fg-faint)" }}>
              <Inline text={result?.hint || card.hint} />
            </span>
          )}
        </span>

        {result && (
          <span className="shrink-0 text-[0.7rem]" style={{ color: "var(--fg-faint)" }}>
            {open ? "hide" : "how"}
          </span>
        )}
      </button>

      {open && result && (
        <div className="pb-4 pl-[29px]">
          <div
            className="quiet-scroll overflow-x-auto rounded-lg px-3 py-2 font-mono text-[0.74rem]"
            style={{ background: "var(--viewer-bg)", color: "var(--viewer-fg)", borderColor: "var(--hairline)" }}
          >
            <div style={{ opacity: 0.55 }}>$ {result.command}</div>
            {result.detail && <div className="mt-1 whitespace-pre-wrap">{result.detail}</div>}
          </div>
        </div>
      )}
    </li>
  );
}

export function Verify({
  slug,
  part,
  checks,
  after,
  color,
}: {
  slug: string;
  part: string;
  checks: CheckCard[];
  after?: AfterAction | null;
  color: string;
}) {
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [busy, setBusy] = useState(false);
  const [ran, setRan] = useState(false);
  const [acted, setActed] = useState("");
  const [acting, setActing] = useState(false);

  /* Something a part offers once its checks have run -- stopping the app it
     asked the student to start, so the tidying up is part of the step rather
     than something left running. */
  async function act() {
    if (!after) return;
    setActing(true);
    try {
      if (after.action === "stop-app") {
        const status = await api.appStop();
        setActed(status.running ? "still running" : "Stopped.");
      }
    } catch {
      setActed("could not stop it");
    } finally {
      setActing(false);
    }
  }

  async function check() {
    setBusy(true);
    try {
      const payload = await api.check(slug, part);
      setResults(Object.fromEntries(payload.results.map((r) => [r.id, r])));
      setRan(true);
    } finally {
      setBusy(false);
    }
  }

  if (!checks.length) return null;

  const passing = checks.filter((c) => results[c.id]?.passed).length;

  return (
    <section className="mt-8">
      <div
        className="rounded-3xl border px-6 py-6 sm:px-8"
        style={{ background: "var(--card)", borderColor: "var(--hairline)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="kicker" style={{ color }}>
              Check your work
            </div>
            <p className="mt-1 text-sm" style={{ color: "var(--fg-faint)" }}>
              {ran
                ? `${passing} of ${checks.length} · asked your machine directly, not this page`
                : "Each of these runs a real read-only command on your machine."}
            </p>
          </div>
          <button
            type="button"
            onClick={check}
            disabled={busy}
            className="rounded-lg px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: color }}
          >
            {busy ? "checking…" : ran ? "check again" : "check"}
          </button>
        </div>

        <ul className="mt-4">
          {checks.map((card) => (
            <Row key={card.id} card={card} result={results[card.id]} />
          ))}
        </ul>

        {ran && passing < checks.length && (
          <p className="mt-4 text-sm" style={{ color: "var(--fg-faint)" }}>
            Nothing here blocks you — you can move on and come back. But these are
            the things the next step assumes.
          </p>
        )}

        {ran && after && passing === checks.length && (
          <div
            className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t pt-4"
            style={{ borderColor: "var(--hairline)" }}
          >
            <button
              type="button"
              onClick={act}
              disabled={acting || acted === "Stopped."}
              className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
              style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-muted)" }}
            >
              {acting ? "Stopping…" : (after.label ?? "Stop the app")}
            </button>
            {acted ? (
              <span className="text-sm" style={{ color: "var(--fg-muted)" }}>
                {acted}
              </span>
            ) : (
              after.note && (
                <span className="text-sm" style={{ color: "var(--fg-faint)" }}>
                  {after.note}
                </span>
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}
