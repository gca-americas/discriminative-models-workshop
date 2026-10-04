import { useEffect, useState } from "react";
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";

import { api, type CoursePayload, type Env, type StepFull } from "./lib/api";
import { Content } from "./components/Content";
import { Exercise } from "./components/Exercise";
import { TopNav } from "./components/TopNav";
import { GoogleCloudLogo } from "./components/GoogleCloudLogo";
import { Verify } from "./components/Verify";

function useCourse() {
  const [payload, setPayload] = useState<CoursePayload | null>(null);
  useEffect(() => {
    api.course().then(setPayload).catch(() => setPayload(null));
  }, []);
  return payload;
}

/** Where a student goes next: the next part of this step, or the next step. */
function neighbours(course: CoursePayload, slug: string, partId: string) {
  const flat: { slug: string; part: string; label: string; step: string }[] = [];
  for (const step of course.steps) {
    const parts = step.parts.length ? step.parts : [{ id: "", label: "" }];
    for (const part of parts) {
      flat.push({
        slug: step.slug,
        part: part.id,
        label: part.label || step.title,
        step: step.title,
      });
    }
  }
  const index = flat.findIndex((entry) => entry.slug === slug && entry.part === partId);
  return {
    flat,
    index,
    previous: index > 0 ? flat[index - 1] : null,
    next: index >= 0 && index < flat.length - 1 ? flat[index + 1] : null,
  };
}

function href(entry: { slug: string; part: string }) {
  return entry.part ? `/step/${entry.slug}/${entry.part}` : `/step/${entry.slug}`;
}

function StepPage({ course }: { course: CoursePayload }) {
  const { slug = "", part: partParam } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<StepFull | null>(null);
  const [env, setEnv] = useState<Env | null>(null);

  useEffect(() => {
    setStep(null);
    api.step(slug).then(setStep).catch(() => setStep(null));
    api.env().then(setEnv).catch(() => setEnv(null));
    window.scrollTo({ top: 0 });
  }, [slug, partParam]);

  // The model light follows setup running in the background, so keep asking.
  useEffect(() => {
    const timer = setInterval(() => api.env().then(setEnv).catch(() => {}), 10000);
    return () => clearInterval(timer);
  }, []);

  const part =
    step?.partDetail.find((p) => p.id === (partParam ?? "")) ?? step?.partDetail[0] ?? null;
  const partId = part?.id ?? "";
  // One part means the step is the part: no letter, no second label.
  const manyParts = (step?.partDetail.length ?? 0) > 1;

  const { previous, next, index, flat } = neighbours(course, slug, partId);
  const accent = `var(--${step?.color ?? "sky"})`;

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accent);
  }, [accent]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      if (event.key === "ArrowRight" && next) navigate(href(next));
      if (event.key === "ArrowLeft" && previous) navigate(href(previous));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous, navigate]);

  return (
    <>
      <TopNav
        course={course.course}
        steps={course.steps}
        activeSlug={slug}
        activePart={partId}
        env={env}
        onEnv={setEnv}
      />

      <main className="stage-content mx-auto max-w-4xl px-5 pb-28">
        {!step || !part ? (
          <div className="py-28 text-center text-sm" style={{ color: "var(--fg-faint)" }}>
            loading…
          </div>
        ) : (
          <>
            <div className="px-2 pt-16 pb-4 text-center">
              <div className="kicker" style={{ color: accent }}>
                {step.kicker}
                {manyParts && part.id ? part.id : ""}
                {manyParts && part.label ? ` · ${part.label}` : ""}
              </div>

              <h1 className="display text-balance mx-auto mt-4 max-w-3xl text-[2.4rem] leading-[1.1] sm:text-[3rem]">
                {part.headline || step.title}
              </h1>

              {step.summary && (
                <p
                  className="text-balance mx-auto mt-5 max-w-2xl text-[1.05rem] leading-relaxed"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {step.summary}
                </p>
              )}

            </div>

            <Content markdown={part.body} slug={step.slug} color={accent} exercises={part.exercises ?? {}} />

            {part.exercise && (
              <Exercise slug={step.slug} exercise={part.exercise} color={accent} />
            )}
            <Verify
              slug={step.slug}
              part={part.id}
              checks={part.checks}
              after={part.after}
              color={accent}
            />

            <nav
              className="mt-14 flex items-center justify-between gap-4 border-t pt-6 text-sm"
              style={{ borderColor: "var(--hairline)" }}
            >
              {previous ? (
                <button
                  type="button"
                  onClick={() => navigate(href(previous))}
                  className="min-w-0 text-left"
                  style={{ color: "var(--fg-muted)" }}
                >
                  <span className="kicker block" style={{ color: "var(--fg-faint)" }}>
                    back
                  </span>
                  <span className="truncate">← {previous.label}</span>
                </button>
              ) : (
                <span />
              )}

              <span className="shrink-0 text-xs" style={{ color: "var(--fg-faint)" }}>
                {index + 1} / {flat.length}
              </span>

              {next ? (
                <button
                  type="button"
                  onClick={() => navigate(href(next))}
                  className="min-w-0 text-right"
                  style={{ color: accent }}
                >
                  <span className="kicker block" style={{ color: "var(--fg-faint)" }}>
                    next
                  </span>
                  <span className="truncate font-medium">{next.label} →</span>
                </button>
              ) : (
                <span />
              )}
            </nav>

            <footer
              className="mt-16 flex flex-col items-center gap-3 border-t pt-8 pb-4"
              style={{ borderColor: "var(--hairline)" }}
            >
              <GoogleCloudLogo height={16} style={{ color: "var(--fg-muted)" }} />
              {course.course.credit && (
                <p className="text-center text-[0.78rem]" style={{ color: "var(--fg-faint)" }}>
                  {course.course.credit}
                </p>
              )}
            </footer>
          </>
        )}
      </main>
    </>
  );
}

export default function App() {
  const course = useCourse();

  useEffect(() => {
    try {
      const saved = localStorage.getItem("jev101.theme");
      document.documentElement.dataset.theme = saved === "light" ? "light" : "dark";
    } catch {
      document.documentElement.dataset.theme = "dark";
    }
  }, []);

  if (!course) {
    return (
      <>
        <div className="ambience" aria-hidden>
        <div className="ambience__blob ambience__blob--one" />
        <div className="ambience__blob ambience__blob--two" />
        <div className="ambience__blob ambience__blob--three" />
        <div className="ambience__grid" />
      </div>
        <div
          className="stage-content grid h-screen place-items-center text-sm"
          style={{ color: "var(--fg-faint)" }}
        >
          loading the course…
        </div>
      </>
    );
  }

  const first = course.steps[0]?.slug ?? "";

  return (
    <div className="stage-vignette">
      <div className="ambience" aria-hidden>
        <div className="ambience__blob ambience__blob--one" />
        <div className="ambience__blob ambience__blob--two" />
        <div className="ambience__blob ambience__blob--three" />
        <div className="ambience__grid" />
      </div>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to={`/step/${first}`} replace />} />
          <Route path="/step/:slug" element={<StepPage course={course} />} />
          <Route path="/step/:slug/:part" element={<StepPage course={course} />} />
          <Route path="*" element={<Navigate to={`/step/${first}`} replace />} />
        </Routes>
      </Router>
    </div>
  );
}
