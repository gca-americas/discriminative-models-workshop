/* A threshold the student moves over "is the ogre open to attack?" answers.

   The chances are fixed; the line is the student's. The counters show what a
   threshold trades, and the goal is the most openings with no hits. */

import { useState } from "react";

// (the model's chance that the ogre left an opening, whether it really did)
const MOVES: { p: number; open: boolean; text: string }[] = [
  { p: 0.97, open: true, text: "staggers, off balance, its guard wide open" },
  { p: 0.93, open: true, text: "gasps for breath, the club dragging on the ground" },
  { p: 0.88, open: true, text: "trips on a loose stone and drops to one knee" },
  { p: 0.81, open: true, text: "throws its head back and roars, chest bared" },
  { p: 0.74, open: false, text: "lowers the club and grins at you" },
  { p: 0.66, open: true, text: "turns to look at the crowd" },
  { p: 0.58, open: false, text: "sways as if dizzy, then plants its feet" },
  { p: 0.49, open: false, text: "twitches the club upward, then does nothing" },
  { p: 0.37, open: false, text: "circles you slowly, watching" },
  { p: 0.22, open: false, text: "snatches a rock from the ground" },
  { p: 0.11, open: false, text: "swings its club low, aiming at your knees" },
  { p: 0.04, open: false, text: "raises its club high over its head" },
];

export function Threshold() {
  const [threshold, setThreshold] = useState(0.7);
  const above = MOVES.filter((m) => m.p >= threshold);
  const taken = above.filter((m) => m.open).length;
  const wrongly = above.filter((m) => !m.open).length;
  const missed = MOVES.filter((m) => m.p < threshold && m.open).length;
  // The best any line can do on these moves: most openings with no hits.
  const best = Math.max(...MOVES.map((m) => {
    const hit = MOVES.filter((x) => x.p >= m.p);
    return hit.some((x) => !x.open) ? 0 : hit.filter((x) => x.open).length;
  }));
  const found = wrongly === 0 && taken === best;

  return (
    <div
      className="rounded-2xl border px-4 py-4"
      style={{ borderColor: "var(--hairline)", background: "var(--overlay)" }}
    >
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm" style={{ color: "var(--fg-muted)" }}>
          strike when the chance of an opening is at least <b style={{ color: "var(--fg)" }}>{threshold.toFixed(2)}</b>
        </label>
        <input
          type="range"
          min={0.05}
          max={0.95}
          step={0.01}
          value={threshold}
          onChange={(event) => setThreshold(Number(event.target.value))}
          className="min-w-40 flex-1"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-xs" style={{ color: "var(--fg-muted)" }}>
        <span>
          <b style={{ color: "var(--ok)" }}>{taken}</b> good {taken === 1 ? "strike" : "strikes"}
        </span>
        <span>
          <b style={{ color: "var(--bad)" }}>{wrongly}</b> struck into an attack
        </span>
        <span>
          <b style={{ color: "var(--fg)" }}>{missed}</b> {missed === 1 ? "opening" : "openings"} missed
        </span>
      </div>

      <ul className="mt-4 space-y-1.5">
        {MOVES.map((move) => {
          const acted = move.p >= threshold;
          const mistake = acted !== move.open;
          return (
            <li key={move.text} className="grid items-center gap-3 text-xs"
                style={{ gridTemplateColumns: "3rem 1fr 7rem" }}>
              <span className="font-mono" style={{ color: acted ? "var(--fg)" : "var(--fg-faint)" }}>
                {move.p.toFixed(2)}
              </span>
              <span className="truncate" style={{ color: acted ? "var(--fg)" : "var(--fg-faint)" }}>
                the ogre {move.text}
              </span>
              <span
                className="text-right font-medium"
                style={{ color: mistake ? "var(--bad)" : acted ? "var(--ok)" : "var(--fg-faint)" }}
              >
                {acted ? (move.open ? "good strike" : "got hit") : move.open ? "missed opening" : "waited"}
              </span>
            </li>
          );
        })}
      </ul>
      <div
        className="mt-4 rounded-xl border px-3 py-2 text-sm"
        style={{
          borderColor: found ? "var(--ok)" : "var(--hairline)",
          color: found ? "var(--ok)" : "var(--fg-muted)",
          background: found ? "color-mix(in srgb, var(--ok) 10%, transparent)" : "transparent",
        }}
        aria-live="polite"
      >
        {found
          ? `Found it. ${best} good strikes and no hits.`
          : `Goal: take the most openings without getting hit. The best on these moves is ${best}.`}
      </div>
    </div>
  );
}
