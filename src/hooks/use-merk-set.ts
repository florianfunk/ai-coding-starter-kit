"use client";

// PROJ-20: Gemeinsame optimistische Merken-Logik für Listen-Ansichten.
// Hält ein Set gemerkter Buchungs-IDs + ein Set laufender Toggles und kapselt
// das optimistische Update inkl. Rollback und Toast. So teilen sich Ledger-
// Zeile und Detail-Sheet (gleiche Buchung) denselben Zustand.

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { toggleMerken } from "@/lib/merken";

export function useMerkSet(initialIds: string[]) {
  const [gemerkt, setGemerkt] = useState<Set<string>>(
    () => new Set(initialIds),
  );
  const [pending, setPending] = useState<Set<string>>(() => new Set());

  const istGemerkt = useCallback((id: string) => gemerkt.has(id), [gemerkt]);
  const istPending = useCallback((id: string) => pending.has(id), [pending]);

  const toggle = useCallback(
    async (id: string) => {
      if (pending.has(id)) return;
      const gewollt = !gemerkt.has(id);

      // Optimistisch umschalten + als laufend markieren.
      setGemerkt((prev) => {
        const next = new Set(prev);
        if (gewollt) next.add(id);
        else next.delete(id);
        return next;
      });
      setPending((prev) => new Set(prev).add(id));

      const ok = await toggleMerken(id, gewollt);

      setPending((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      if (!ok) {
        // Rollback.
        setGemerkt((prev) => {
          const next = new Set(prev);
          if (gewollt) next.delete(id);
          else next.add(id);
          return next;
        });
        toast.error("Merken fehlgeschlagen — bitte erneut versuchen.");
      } else {
        toast.success(gewollt ? "Gemerkt" : "Von Merkliste entfernt");
      }
    },
    [gemerkt, pending],
  );

  return { istGemerkt, istPending, toggle };
}
