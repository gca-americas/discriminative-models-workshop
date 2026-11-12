/* The shared pieces every figure is drawn from: text styles, an arrowhead,
   a labelled box and a probability bar. */

export const label = { fontSize: 11, fill: "var(--fg-muted)", fontFamily: "inherit" } as const;
export const faint = { fontSize: 10.5, fill: "var(--fg-faint)", fontFamily: "inherit" } as const;
export const strong = { fontSize: 12, fill: "var(--fg)", fontWeight: 600, fontFamily: "inherit" } as const;
export const mono = { fontSize: 10.5, fill: "var(--fg-muted)", fontFamily: "ui-monospace, monospace" } as const;

export function Arrow({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
      <path d="M0 0 L7 3.5 L0 7 z" fill={color} />
    </marker>
  );
}

export function Box({
  x, y, w = 110, h = 46, title, note, accent = false, dashed = false,
}: {
  x: number; y: number; w?: number; h?: number;
  title: string; note?: string; accent?: boolean; dashed?: boolean;
}) {
  return (
    <g>
      <rect
        x={x} y={y} width={w} height={h} rx="8"
        fill={accent ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "var(--card)"}
        stroke={accent ? "var(--accent)" : "var(--hairline-strong)"}
        strokeDasharray={dashed ? "4 3" : undefined}
      />
      <text x={x + w / 2} y={note ? y + h / 2 - 2 : y + h / 2 + 4}
            textAnchor="middle" style={strong}>
        {title}
      </text>
      {note && (
        <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" style={faint}>
          {note}
        </text>
      )}
    </g>
  );
}

export function Bar({ x, y, value, name, win = false, width = 150 }: {
  x: number; y: number; value: number; name: string; win?: boolean; width?: number;
}) {
  return (
    <g>
      <text x={x} y={y + 9} style={win ? strong : label}>{name}</text>
      <rect x={x + 70} y={y} width={width} height={10} rx="5" fill="var(--overlay)" stroke="var(--hairline)" />
      <rect x={x + 70} y={y} width={Math.max(2, width * value)} height={10} rx="5"
            fill={win ? "var(--accent)" : "var(--fg-faint)"} />
      <text x={x + 70 + width + 8} y={y + 9} style={mono}>{value.toFixed(2)}</text>
    </g>
  );
}
