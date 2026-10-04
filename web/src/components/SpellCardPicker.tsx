/* Step 6b: the spell card the slow branch sends to Gemini. Picking one copies
   it to branches/spell_card.png (and its answer to spell_card.json), which is
   what slow_branch.py reads, so the next run reads the card shown here. */

import { useEffect, useState } from "react";

import { api } from "../lib/api";

export function SpellCardPicker({ color }: { color: string }) {
  const [cards, setCards] = useState<{ id: string; url: string }[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.branchCards().then((r) => { setCards(r.cards); setSelected(r.selected); }).catch(() => {});
  }, []);

  async function choose(card: string) {
    if (busy || card === selected) return;
    setBusy(true);
    try {
      const r = await api.chooseBranchCard(card);
      setSelected(r.selected);
    } finally {
      setBusy(false);
    }
  }

  if (!cards.length) return null;
  return (
    <div className="mt-3">
      <div className="mb-2 text-xs" style={{ color: "var(--fg-faint)" }}>
        Choose the card Gemini reads on the next run.
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cards.map((card, index) => {
          const on = card.id === selected;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => choose(card.id)}
              aria-pressed={on}
              className="rounded-xl border-2 p-1.5 text-left disabled:opacity-60"
              disabled={busy}
              style={{ borderColor: on ? color : "var(--hairline)", background: on ? `color-mix(in srgb, ${color} 10%, transparent)` : "var(--card)" }}
            >
              <img src={card.url} alt={`Spell card ${index + 1}`} className="block w-full rounded-md" />
              <div className="mt-1 px-0.5 text-xs" style={{ color: on ? color : "var(--fg-muted)", fontWeight: on ? 600 : 400 }}>
                Card {index + 1}{on ? " · selected" : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
