// PROJ-18 — Empfänger-Regel-Helper, gemeinsam genutzt von Abo-Radar
// (PROJ-14) und Lieferanten-Tab (PROJ-18). Idempotent: existiert
// bereits eine aktive Regel mit demselben Empfänger-Muster + derselben
// Kategorie, wird sie nicht erneut angelegt.
//
// Liefert ein Status-Flag, damit der Aufrufer den passenden Toast
// zeigen kann.

import { toast } from "sonner";
import type { KategorieTyp } from "@/lib/types";

export type RegelStatus =
  | "angelegt"
  | "vorhanden"
  | "fehler"
  | "uebersprungen";

export async function lerneRegelFuer(
  empfaenger: string,
  kategorieId: string,
  kategorieTyp: KategorieTyp | null,
): Promise<RegelStatus> {
  const muster = empfaenger.trim();
  if (muster.length < 2) return "uebersprungen";

  const klassifikation: "privat" | "geschaeftlich" | "neutral" =
    kategorieTyp === "privat"
      ? "privat"
      : kategorieTyp === "neutral"
        ? "neutral"
        : "geschaeftlich";

  const rg = await fetch("/api/regeln");
  if (rg.ok) {
    const jr = (await rg.json()) as {
      data: Array<{
        bedingung: { empfaenger_muster?: string | null } | null;
        aktion: { kategorie_id?: string | null } | null;
        aktiv: boolean;
      }>;
    };
    const norm = muster.toLowerCase();
    const bestehtSchon = (jr.data ?? []).some(
      (re) =>
        re.aktiv &&
        (re.bedingung?.empfaenger_muster ?? "").toLowerCase().trim() ===
          norm &&
        re.aktion?.kategorie_id === kategorieId,
    );
    if (bestehtSchon) return "vorhanden";
  }

  const reg = await fetch("/api/regeln", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bezeichnung: `Empfänger: ${muster}`.slice(0, 120),
      bedingung: { empfaenger_muster: muster },
      aktion: { kategorie_id: kategorieId, klassifikation },
      prioritaet: 100,
      aktiv: true,
    }),
  });
  if (reg.ok) return "angelegt";
  const e = (await reg.json().catch(() => null)) as { error?: string } | null;
  toast.warning(
    "Regel konnte nicht angelegt werden: " +
      (e?.error ?? `HTTP ${reg.status}`),
  );
  return "fehler";
}

/**
 * Klassifikations-only-Regel (PROJ-18): "Immer privat" / "Immer
 * geschäftlich" für einen Empfänger, ohne Kategorie-Zuweisung.
 * Idempotent über (muster, klassifikation, kategorie_id=null).
 */
export async function lerneKlassifikationsRegel(
  empfaenger: string,
  klassifikation: "privat" | "geschaeftlich",
): Promise<RegelStatus> {
  const muster = empfaenger.trim();
  if (muster.length < 2) return "uebersprungen";

  const rg = await fetch("/api/regeln");
  if (rg.ok) {
    const jr = (await rg.json()) as {
      data: Array<{
        bedingung: { empfaenger_muster?: string | null } | null;
        aktion: {
          kategorie_id?: string | null;
          klassifikation?: string | null;
        } | null;
        aktiv: boolean;
      }>;
    };
    const norm = muster.toLowerCase();
    const bestehtSchon = (jr.data ?? []).some(
      (re) =>
        re.aktiv &&
        (re.bedingung?.empfaenger_muster ?? "").toLowerCase().trim() ===
          norm &&
        !re.aktion?.kategorie_id &&
        re.aktion?.klassifikation === klassifikation,
    );
    if (bestehtSchon) return "vorhanden";
  }

  const reg = await fetch("/api/regeln", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bezeichnung: `Empfänger: ${muster} → ${klassifikation}`.slice(0, 120),
      bedingung: { empfaenger_muster: muster },
      aktion: { klassifikation },
      prioritaet: 100,
      aktiv: true,
    }),
  });
  if (reg.ok) return "angelegt";
  const e = (await reg.json().catch(() => null)) as { error?: string } | null;
  toast.warning(
    "Regel konnte nicht angelegt werden: " +
      (e?.error ?? `HTTP ${reg.status}`),
  );
  return "fehler";
}

export function regelToast(
  status: RegelStatus,
  empfaenger: string,
  fallback: string,
) {
  if (status === "angelegt") {
    toast.success(`${fallback} — Regel für "${empfaenger}" gelernt`);
  } else if (status === "vorhanden") {
    toast.success(`${fallback} — passende Regel ist bereits aktiv`);
  } else {
    toast.success(fallback);
  }
}
