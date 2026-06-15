// PROJ-21: Reine Helfer & Typen für Lieferanten-Notizen. Bewusst KEIN IO
// (kein Supabase, kein Zod) — wird von API-Routen und UI genutzt und ist
// ohne DB testbar.

/** Eine einzelne Notiz, wie sie API und UI austauschen. */
export interface LieferantNotiz {
  id: string;
  empfaenger_norm: string;
  inhalt: string;
  erstellt_am: string;
  aktualisiert_am: string;
}

/** Alle Notizen eines Lieferanten, gebündelt für die Übersichtsseite. */
export interface LieferantNotizGruppe {
  empfaenger_norm: string;
  /** Anzeigename (häufigste Roh-Schreibweise oder Fallback). */
  empfaenger_anzeige: string;
  notizen: LieferantNotiz[];
  /** ISO-Zeitstempel der jüngsten Notiz — Sortierschlüssel der Übersicht. */
  zuletzt_am: string;
}

/** Roh-Zeile aus der DB inkl. Beispiel-Rohwert für den Anzeigenamen. */
export interface LieferantNotizRow extends LieferantNotiz {
  rohwert_beispiel: string | null;
}

/**
 * Gruppiert eine flache Notiz-Liste nach `empfaenger_norm`. Innerhalb jeder
 * Gruppe: jüngste Notiz zuerst. Gruppen: zuletzt ergänzte zuerst.
 * `anzeigeNamen` (norm → Anzeigename, z. B. aus Buchungen abgeleitet) hat
 * Vorrang; sonst greift der Rohwert-Beispiel, sonst der norm-Schlüssel.
 */
export function gruppiereNotizen(
  rows: LieferantNotizRow[],
  anzeigeNamen?: Map<string, string>,
): LieferantNotizGruppe[] {
  const gruppen = new Map<string, LieferantNotizGruppe>();

  for (const r of rows) {
    let g = gruppen.get(r.empfaenger_norm);
    if (!g) {
      g = {
        empfaenger_norm: r.empfaenger_norm,
        empfaenger_anzeige:
          anzeigeNamen?.get(r.empfaenger_norm)?.trim() ||
          r.rohwert_beispiel?.trim() ||
          r.empfaenger_norm,
        notizen: [],
        zuletzt_am: r.aktualisiert_am,
      };
      gruppen.set(r.empfaenger_norm, g);
    }
    g.notizen.push({
      id: r.id,
      empfaenger_norm: r.empfaenger_norm,
      inhalt: r.inhalt,
      erstellt_am: r.erstellt_am,
      aktualisiert_am: r.aktualisiert_am,
    });
    if (r.aktualisiert_am > g.zuletzt_am) g.zuletzt_am = r.aktualisiert_am;
  }

  const ergebnis = Array.from(gruppen.values());
  for (const g of ergebnis) {
    g.notizen.sort((a, b) => b.erstellt_am.localeCompare(a.erstellt_am));
  }
  ergebnis.sort((a, b) => b.zuletzt_am.localeCompare(a.zuletzt_am));
  return ergebnis;
}

/** Kürzt einen Notiztext für Badge-/Tooltip-Vorschau. */
export function notizVorschau(inhalt: string, max = 80): string {
  const t = inhalt.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : t.slice(0, max - 1).trimEnd() + "…";
}
