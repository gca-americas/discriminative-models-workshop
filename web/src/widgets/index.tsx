/* Interactive pieces a step can drop into an exercise by id.

   A figure explains something; a widget lets the student push on it. Kept in
   their own registry so a step asks for one by name, the way it asks for a
   figure. */

import type { ReactNode } from "react";

import { PrimitivePicker } from "./PrimitivePicker";
import { Threshold } from "./Threshold";

const WIDGETS: Record<string, () => ReactNode> = {
  "primitive-picker": PrimitivePicker,
  threshold: Threshold,
};

export function Widget({ id }: { id: string }) {
  const Piece = WIDGETS[id];

  if (!Piece) {
    return (
      <div
        className="mt-4 grid h-28 place-items-center rounded-2xl border border-dashed text-sm"
        style={{ borderColor: "var(--hairline-strong)", color: "var(--fg-faint)" }}
      >
        widget “{id || "unnamed"}” not built yet
      </div>
    );
  }

  return (
    <div className="mt-4">
      <Piece />
    </div>
  );
}
