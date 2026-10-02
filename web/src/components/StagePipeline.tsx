import type { Stage } from "../lib/api";

/* A row of stages that fills in as a command runs.

   The stage is read from the log rather than from a timer, because a timer
   would keep moving while a build was stuck and tell a comfortable lie. Each
   stage declares a pattern in step.yaml; the stage is how many of those have
   appeared so far. */

export function stageFromLog(stages: Stage[], lines: string[]): number {
  const text = lines.join("\n");
  let reached = 0;
  for (const stage of stages) {
    if (!stage.at) break;
    let hit = false;
    try {
      hit = new RegExp(stage.at, "i").test(text);
    } catch {
      hit = text.toLowerCase().includes(stage.at.toLowerCase());
    }
    if (!hit) break;
    reached += 1;
  }
  return reached;
}

export function StagePipeline({ stages, current, failed, label }: {
  stages: Stage[];
  current: number;
  failed: boolean;
  label: string;
}) {
  const count = Math.max(stages.length, 1);
  const width = 460;
  const slot = width / count;
  const box = Math.min(slot - 12, 116);

  return (
    <svg viewBox={`0 0 ${width} 116`} role="img" aria-label={label}
         style={{ width: "100%", maxWidth: width, margin: "0 auto", display: "block" }}>
      {stages.map((stage, index) => {
        const x = index * slot + (slot - box) / 2;
        const done = index < current;
        const active = index === current;
        const colour = failed && active
          ? "var(--bad)"
          : done ? "var(--ok)" : active ? "var(--accent)" : "var(--hairline-strong)";

        return (
          <g key={stage.title}>
            <rect x={x} y={24} width={box} height={48} rx="9"
                  fill={active ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "none"}
                  stroke={colour} strokeWidth={done || active ? 1.6 : 1} />
            <text x={x + box / 2} y={46} textAnchor="middle"
                  style={{ fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                           fill: done || active ? "var(--fg)" : "var(--fg-faint)" }}>
              {stage.title}
            </text>
            <text x={x + box / 2} y={62} textAnchor="middle"
                  style={{ fontSize: 10, fontFamily: "inherit", fill: "var(--fg-faint)" }}>
              {stage.note}
            </text>

            {done && (
              <path d={`M${x + box - 16} 32 l4 4 l7 -8`} fill="none" stroke="var(--ok)"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}

            {index < stages.length - 1 && (
              <line x1={x + box} y1={48} x2={x + box + (slot - box)} y2={48}
                    stroke={colour} strokeWidth="1.4" />
            )}

            {active && !failed && (
              <circle cx={x + box / 2} cy={84} r="3" fill="var(--accent)">
                <animate attributeName="opacity" values="0.25;1;0.25" dur="1.2s"
                         repeatCount="indefinite" />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}
