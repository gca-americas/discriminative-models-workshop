import { useMemo, useState } from "react";

import { api } from "../lib/api";
import { parseBlocks, type Block } from "../lib/blocks";
import { Figure } from "../illustrations";

/* Panels, following the workbench house style: a full hairline border on a
   translucent panel, never a coloured edge. A callout is distinguished by its
   kicker, not by a stripe -- which is what lets panels nest without the page
   turning into a stack of bars. */

const CALLOUT = {
  key: { label: "The point", color: "var(--accent)" },
  note: { label: "Worth knowing", color: "var(--fg-faint)" },
  warn: { label: "Careful", color: "var(--amber)" },
} as const;

function Callout({ variant, html }: { variant: keyof typeof CALLOUT; html: string }) {
  const { label, color } = CALLOUT[variant];
  return (
    <aside
      className="my-6 rounded-2xl border p-5"
      style={{ borderColor: "var(--hairline)", background: "var(--overlay)" }}
    >
      <div className="kicker mb-2" style={{ color }}>
        {label}
      </div>
      <div
        className="prose [&>p:last-child]:mb-0 [&>p]:text-[var(--fg)]"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </aside>
  );
}

function Section({
  kicker,
  headline,
  children,
}: {
  kicker: string;
  headline: string;
  children: Block[];
}) {
  return (
    <section
      className="my-7 rounded-3xl border p-6 sm:p-8"
      style={{ borderColor: "var(--hairline)", background: "var(--card)" }}
    >
      {kicker && (
        <div className="kicker" style={{ color: "var(--fg-faint)" }}>
          {kicker}
        </div>
      )}
      {headline && (
        <h2 className="display text-balance mt-3 mb-5 text-[1.5rem] leading-[1.2]">
          {headline}
        </h2>
      )}
      <Blocks blocks={children} />
    </section>
  );
}

function Columns({ children }: { children: Block[][] }) {
  return (
    <div
      className="my-6 grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))" }}
    >
      {children.map((column, index) => (
        <div
          key={index}
          className="rounded-2xl border p-4"
          style={{ borderColor: "var(--hairline)", background: "var(--overlay)" }}
        >
          <Blocks blocks={column} />
        </div>
      ))}
    </div>
  );
}

/* The console cannot be embedded -- it refuses to be framed -- so the best the
   workbench can do is open it in a tab, pointed at the right page. */
function ConsoleLink({ url, label, note }: { url: string; label: string; note: string }) {
  return (
    <div className="my-4 flex flex-wrap items-center gap-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border px-3.5 py-1.5 text-sm font-medium"
        style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
      >
        {label} ↗
      </a>
      {note && (
        <span className="text-xs" style={{ color: "var(--fg-faint)" }}>
          {note}
        </span>
      )}
    </div>
  );
}

/* A project file behind a button: the reader asks to see it, and it opens
   in place, read-only, in the theme's code colours. */
function FileReveal({ path, label }: { path: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[] | null>(null);
  const [problem, setProblem] = useState("");

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && lines === null && !problem) {
      try {
        const file = await api.fileRead(path);
        if (file.error) setProblem(file.error);
        else setLines(file.lines ?? []);
      } catch {
        setProblem("could not read the file");
      }
    }
  }

  return (
    <div className="my-5">
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
        style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-muted)", background: "var(--card)" }}
        aria-expanded={open}
      >
        <span className="font-mono text-[0.8rem]" style={{ color: "var(--fg)" }}>{path}</span>
        <span>{open ? "Hide" : label || "Show"}</span>
      </button>
      {open && (
        <div
          className="quiet-scroll mt-3 overflow-auto rounded-2xl border"
          style={{ maxHeight: 560, background: "var(--viewer-bg)", borderColor: "var(--hairline)" }}
        >
          {problem ? (
            <p className="p-4 font-mono text-[0.75rem]" style={{ color: "var(--bad)" }}>{problem}</p>
          ) : lines === null ? (
            <p className="p-4 font-mono text-[0.75rem]" style={{ color: "var(--fg-faint)" }}>loading…</p>
          ) : (
            <pre className="m-0 p-3 font-mono text-[0.73rem] leading-[1.55]">
              {lines.map((line, index) => (
                <div key={index} className="flex">
                  <span className="w-9 shrink-0 select-none pr-3 text-right" style={{ color: "var(--fg-faint)", opacity: 0.55 }}>
                    {index + 1}
                  </span>
                  <span style={{ color: "var(--viewer-fg)", whiteSpace: "pre-wrap" }}>{line || " "}</span>
                </div>
              ))}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block, index) => {
        if (block.kind === "figure") {
          return <Figure key={index} id={block.id} caption={block.caption} src={block.src} />;
        }
        if (block.kind === "file") {
          return <FileReveal key={index} path={block.path} label={block.label} />;
        }
        if (block.kind === "console") {
          return (
            <ConsoleLink key={index} url={block.url} label={block.label} note={block.note} />
          );
        }
        if (block.kind === "callout") {
          return <Callout key={index} variant={block.variant} html={block.html} />;
        }
        if (block.kind === "section") {
          return (
            <Section key={index} kicker={block.kicker} headline={block.headline}>
              {block.children}
            </Section>
          );
        }
        if (block.kind === "columns") {
          return <Columns key={index}>{block.children}</Columns>;
        }
        return (
          <div
            key={index}
            className="prose table-scroll quiet-scroll"
            dangerouslySetInnerHTML={{ __html: block.html }}
          />
        );
      })}
    </>
  );
}

/** A part's teaching content: markdown, section panels, callouts, figures. */
export function Content({ markdown }: { markdown: string }) {
  const blocks = useMemo(() => parseBlocks(markdown), [markdown]);
  return <Blocks blocks={blocks} />;
}
