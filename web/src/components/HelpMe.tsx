/* The same affordance the terminal has: fill in a request that works, so a
   stuck student can read one rather than guess at the wording. It fills the
   box and stops -- sending it is still theirs to do. */
export function HelpMe({ example, onUse }: { example?: string; onUse: (text: string) => void }) {
  if (!example) return null;
  return (
    <button
      type="button"
      onClick={() => onUse(example)}
      title={`Fills in: ${example}`}
      className="rounded-full border px-2.5 py-[3px] text-[0.68rem]"
      style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-muted)" }}
    >
      Help me
    </button>
  );
}
