import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";

import { api, type CoursePayload, type Env, type StepCard } from "../lib/api";
import { GoogleCloudLogo } from "./GoogleCloudLogo";

function ThemeToggle() {
  // Anything that is not an explicit "light" is the dark stage, so a stale
  // stored value can never leave the toggle pointing at a third state.
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("jev101.theme", theme);
    } catch {
      /* private windows and blocked site data: the page works without it */
    }
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title={`Theme: ${theme}`}
      className="grid h-7 w-7 place-items-center rounded-md border text-xs"
      style={{ borderColor: "var(--hairline)", color: "var(--fg-faint)" }}
    >
      {theme === "dark" ? "◐" : "○"}
    </button>
  );
}

/* Two keys decide what will work on this machine: the Discriminative model's and Gemini's. The
   pill says which are present, so a student who hits an auth error in step 2
   can see why without reading a stack trace. */
function EnvPill({ env, onEnv }: { env: Env | null; onEnv: (env: Env) => void }) {
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  if (!env) return null;

  // Click the model light to ask the model now, rather than wait for the next look.
  async function checkModel() {
    setChecking(true);
    setMessage("");
    try {
      const result = await api.modelCheck();
      onEnv(result.env);
      setMessage(result.message);
    } catch {
      setMessage("The workbench did not answer.");
    } finally {
      setChecking(false);
      setTimeout(() => setMessage(""), 5000);
    }
  }

  const setting = env.modelSetup === "gemma" ? "diffusiongemma" : env.modelSetup;
  const bits: { label: string; ok: boolean; check?: boolean }[] = [
    { label: setting ? `model · setting up ${setting}` : `model · ${env.jev}`, ok: env.modelReady && !setting, check: true },
    { label: `gemini · ${env.gemini}`, ok: env.geminiReady },
  ];

  return (
    <span className="relative flex items-center gap-1.5">
      {bits.map((bit) => {
        const style = {
          borderColor: bit.ok ? "color-mix(in srgb, var(--ok) 45%, transparent)" : "var(--hairline)",
          color: bit.ok ? "var(--fg-muted)" : "var(--fg-faint)",
        };
        return bit.check ? (
          <button
            key={bit.label}
            type="button"
            onClick={checkModel}
            disabled={checking}
            className="rounded-md border px-2 py-1 font-mono text-[0.7rem] hover:opacity-80"
            title="Click to check that the model endpoint works"
            style={style}
          >
            {checking ? "model · checking…" : bit.label}
          </button>
        ) : (
          <span key={bit.label} className="rounded-md border px-2 py-1 font-mono text-[0.7rem]" title={bit.ok ? "ready" : "not ready yet"} style={style}>
            {bit.label}
          </span>
        );
      })}
      {message && (
        <span
          className="absolute right-0 top-full mt-1.5 whitespace-nowrap rounded-md border px-2 py-1 text-[0.72rem]"
          style={{ background: "var(--card)", borderColor: "var(--hairline)", color: "var(--fg-muted)" }}
          role="status"
        >
          {message}
        </span>
      )}
    </span>
  );
}

export function TopNav({
  course,
  steps,
  activeSlug,
  activePart,
  env,
  onEnv,
}: {
  course: CoursePayload["course"];
  steps: StepCard[];
  activeSlug: string;
  activePart: string;
  env: Env | null;
  onEnv: (env: Env) => void;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const activeIndex = steps.findIndex((s) => s.slug === activeSlug);
  const active = steps[activeIndex];
  // A step with one part has nothing to navigate between, so it gets no row.
  const named = (active?.parts ?? []).filter((p) => p.id);
  const parts = named.length > 1 ? named : [];

  useEffect(() => {
    rail.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activeSlug]);

  return (
    <header
      className="sticky z-20 border-b backdrop-blur-xl"
      style={{
        top: "env(safe-area-inset-top, 0px)",
        borderColor: "var(--hairline)",
        background: "color-mix(in srgb, var(--stage) 82%, transparent)",
      }}
    >
      {/* brand */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <NavLink to={`/step/${steps[0]?.slug ?? ""}`} className="flex items-center">
          <span className="text-[1.05rem] font-bold tracking-[-0.02em]">{course.title}</span>
        </NavLink>

        <div className="ml-auto flex items-center gap-3">
          {/* On every page: this is a Google Cloud workshop. */}
          <GoogleCloudLogo height={15} style={{ color: "var(--fg-muted)" }} />
          <span className="hidden sm:inline" style={{ color: "var(--hairline-strong)" }}>
            ·
          </span>
          <EnvPill env={env} onEnv={onEnv} />
          <ThemeToggle />
        </div>
      </div>

      {/* the steps */}
      <div ref={rail} className="quiet-scroll overflow-x-auto">
        <div className="mx-auto flex max-w-6xl items-center gap-1 px-5 pb-2">
          {steps.map((step, index) => {
            const isActive = step.slug === activeSlug;
            const done = index < activeIndex;
            const accent = `var(--${step.color})`;

            return (
              <div key={step.slug} className="flex shrink-0 items-center">
                <NavLink
                  to={`/step/${step.slug}`}
                  data-active={isActive}
                  title={`${step.kicker} · ${step.title}`}
                  className="flex items-center gap-2 rounded-full border px-2 py-1 text-xs whitespace-nowrap transition-colors"
                  style={{
                    borderColor: isActive ? accent : "var(--hairline)",
                    background: isActive
                      ? `color-mix(in srgb, ${accent} 14%, transparent)`
                      : "transparent",
                    color: isActive ? accent : done ? "var(--fg-faint)" : "var(--fg-muted)",
                  }}
                >
                  <span
                    className="grid h-[19px] w-[19px] place-items-center rounded-full text-[10px] font-semibold"
                    style={{
                      background: isActive ? accent : "transparent",
                      border: isActive ? "none" : "1px solid var(--hairline-strong)",
                      color: isActive ? "var(--stage)" : "inherit",
                    }}
                  >
                    {done ? "✓" : index}
                  </span>
                  {isActive && <span className="pr-1 font-semibold">{step.title}</span>}
                </NavLink>
                {index < steps.length - 1 && (
                  <span className="px-0.5 text-[10px]" style={{ color: "var(--hairline-strong)" }}>
                    ›
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* the parts of the active step */}
      {parts.length > 0 && (
        <div
          className="quiet-scroll overflow-x-auto border-t"
          style={{ borderColor: "var(--hairline)" }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-5 py-2">
            {parts.map((part) => {
              const isActive = part.id === activePart;
              const accent = `var(--${active.color})`;
              return (
                <NavLink
                  key={part.id}
                  to={`/step/${activeSlug}/${part.id}`}
                  className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-1.5 text-xs whitespace-nowrap"
                  style={{
                    borderColor: isActive ? accent : "var(--hairline)",
                    background: isActive
                      ? `color-mix(in srgb, ${accent} 12%, transparent)`
                      : "transparent",
                    color: isActive ? accent : "var(--fg-muted)",
                  }}
                >
                  <span className="font-mono font-semibold">
                    {active.order}
                    {part.id}
                  </span>
                  <span className={isActive ? "font-medium" : ""}>{part.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
