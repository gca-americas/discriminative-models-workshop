/* A pop-up that shows a piece of code in full, coloured, over the page.

   Figures summarise a request in a few lines; this is where the whole thing
   lives. The colours come from --syn-* tokens, so they follow the theme. */

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

const COLOR = {
  key: "var(--syn-key)",
  str: "var(--syn-str)",
  num: "var(--syn-num)",
  kw: "var(--syn-kw)",
  punct: "var(--syn-punct)",
};

const JSON_TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:e-?\d+)?)|\b(true|false|null)\b|([{}[\],])/g;

function json(text: string, prefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let n = 0;
  for (const match of text.matchAll(JSON_TOKEN)) {
    const at = match.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const key = `${prefix}-${n++}`;
    if (match[1] && match[2]) {
      out.push(<span key={key} style={{ color: COLOR.key }}>{match[1]}</span>);
      out.push(<span key={`${key}c`} style={{ color: COLOR.punct }}>{match[2]}</span>);
    } else if (match[1]) {
      out.push(<span key={key} style={{ color: COLOR.str }}>{match[1]}</span>);
    } else if (match[3]) {
      out.push(<span key={key} style={{ color: COLOR.num }}>{match[3]}</span>);
    } else if (match[4]) {
      out.push(<span key={key} style={{ color: COLOR.kw }}>{match[4]}</span>);
    } else {
      out.push(<span key={key} style={{ color: COLOR.punct }}>{match[5]}</span>);
    }
    last = at + match[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* An HTTP message: the request line, the headers, a blank line, a JSON body. */
export function highlightHttp(text: string): ReactNode[] {
  const [head, ...rest] = text.split("\n\n");
  const body = rest.join("\n\n");
  const out: ReactNode[] = [];
  head.split("\n").forEach((line, i) => {
    if (i === 0) {
      const [method, ...target] = line.split(" ");
      out.push(<span key="m" style={{ color: COLOR.kw, fontWeight: 600 }}>{method}</span>, " ",
               <span key="u" style={{ color: COLOR.str }}>{target.join(" ")}</span>);
    } else {
      const colon = line.indexOf(":");
      out.push(<span key={`h${i}`} style={{ color: COLOR.key }}>{line.slice(0, colon)}</span>,
               <span key={`p${i}`} style={{ color: COLOR.punct }}>:</span>,
               line.slice(colon + 1));
    }
    out.push("\n");
  });
  if (body) out.push("\n", ...json(body, "b"));
  return out;
}

export function CodePopup({ title, code, format = "http", onClose }: {
  title: string; code: string; format?: "http" | "json"; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ background: "color-mix(in srgb, black 45%, transparent)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border shadow-2xl"
        style={{ background: "var(--card)", borderColor: "var(--hairline-strong)" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: "var(--hairline)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-2.5 py-1 text-xs"
            style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-muted)" }}
          >
            Close
          </button>
        </div>
        <pre
          className="quiet-scroll m-0 overflow-auto px-5 py-4 font-mono text-[0.8rem] leading-relaxed"
          style={{ background: "var(--viewer-bg)", color: "var(--viewer-fg)" }}
        >
          <code>{format === "json" ? json(code, "j") : highlightHttp(code)}</code>
        </pre>
      </div>
    </div>,
    document.body,
  );
}
