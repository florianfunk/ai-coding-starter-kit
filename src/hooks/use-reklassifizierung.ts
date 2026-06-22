"use client";

// PROJ-15 P2 (#1): Re-Klassifizierung einer Auswahl von Buchungen.
//
// Kapselt den POST /api/klassifizierung mit `buchung_ids` (1–500 UUIDs)
// inklusive Loading-State, Toast-Feedback und Fehlerbehandlung — exakt nach
// dem bestehenden Klassifizierungs-Trigger-Muster (siehe
// klassifizierung-center.tsx / pruefliste-ansicht.tsx). Wird sowohl von der
// Buchungs-Liste als auch von der Prüfliste genutzt, damit beide denselben
// Fetch-/Fehler-/Toast-Pfad teilen.

import { useState } from "react";
import { toast } from "sonner";

/** Server-Obergrenze laut Backend-Contract: 1–500 UUIDs pro Aufruf. */
export const MAX_REKLASS_IDS = 500;

interface KlassErgebnis {
  verarbeitet?: number;
  auto_verbucht?: number;
  zur_pruefung?: number;
}

export function useReklassifizierung() {
  const [pending, setPending] = useState(false);

  /**
   * Stößt die Re-Klassifizierung für die übergebenen Buchungs-IDs an.
   * Gibt `true` bei Erfolg zurück, damit der Aufrufer danach neu laden kann.
   * Manuell bestätigte Buchungen werden serverseitig übersprungen.
   */
  async function reklassifiziere(buchungIds: string[]): Promise<boolean> {
    const ids = Array.from(new Set(buchungIds)).filter(Boolean);
    if (ids.length === 0) {
      toast.error("Keine Buchungen ausgewählt.");
      return false;
    }
    if (ids.length > MAX_REKLASS_IDS) {
      toast.error(
        `Es können maximal ${MAX_REKLASS_IDS} Buchungen auf einmal neu klassifiziert werden.`,
      );
      return false;
    }

    setPending(true);
    try {
      const res = await fetch("/api/klassifizierung", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buchung_ids: ids }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ergebnis?: KlassErgebnis; error?: string }
        | null;

      if (res.status === 409) {
        toast.error(
          json?.error ??
            "Es läuft bereits eine Klassifizierung. Bitte warte, bis sie fertig ist.",
        );
        return false;
      }
      if (!res.ok) {
        toast.error(json?.error ?? "Re-Klassifizierung fehlgeschlagen.");
        return false;
      }

      const e = json?.ergebnis ?? {};
      const verarbeitet = e.verarbeitet ?? ids.length;
      toast.success(
        `${verarbeitet} ${verarbeitet === 1 ? "Buchung" : "Buchungen"} neu klassifiziert` +
          (typeof e.auto_verbucht === "number"
            ? ` (${e.auto_verbucht} auto, ${e.zur_pruefung ?? 0} zur Prüfung).`
            : "."),
      );
      return true;
    } catch {
      toast.error("Netzwerkfehler bei der Re-Klassifizierung.");
      return false;
    } finally {
      setPending(false);
    }
  }

  return { reklassifiziere, pending };
}
