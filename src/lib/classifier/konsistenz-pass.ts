// PROJ-15 (Konsistenz-Pro) — Konsistenz-Pass am Ende eines Klassifizierungs-
// Laufs.
//
// Hintergrund: Der LLM klassifiziert pro Buchung stochastisch. Bei haeufig
// vorkommenden Empfaengern (Accenture, Enercity, Rene Kilian, ...) sehen wir
// regelmaessig 1-2 Ausreisser in andere Kategorien. Der Pass zieht alle
// Buchungen eines Empfaengers auf die Mehrheits-Kategorie zusammen — aber
// nur, wenn das Mehrheits-Bild eindeutig genug ist.
//
// Konservative Regeln:
//   - mind. 3 Buchungen pro Empfaenger (kleinere Gruppen statistisch nicht
//     belastbar).
//   - mind. 2 distinct kategorie_id (also: es gibt ueberhaupt eine
//     Inkonsistenz zu beheben).
//   - Mehrheits-Kategorie muss
//      a) mind. 60% der auto_verbuchten Buchungen abdecken,
//      b) eine Durchschnitts-Konfidenz von >= 0.85 haben,
//      c) die Klassifikation (privat/geschaeftlich/neutral) muss einheitlich
//         sein — wenn der Empfaenger sowohl 'privat' als auch 'geschaeftlich'
//         Buchungen hat, ist der Pass NICHT zustaendig (z. B. Tankstelle,
//         gemischt Privat- und Firmenwagen).
//   - PayPal-artige Empfaenger profitieren genau von der 60%-Regel: bei
//     75% Privat + 5% Geldtransit-Buchungen waere zwar die Mehrheits-Kategorie
//     "privat", aber die 4 Geldtransit-Buchungen haben Klassifikation
//     'neutral' — die Mehrheits-Klassifikation ist 'privat'. Damit verletzt
//     PayPal Kriterium (c) (Mischklassifikation) und wird NICHT angepasst.
//     Genau so soll es sein: Geldtransit-Buchungen bleiben unangetastet.
//
// Sicherheit:
//   - status='manuell_bestaetigt'-Buchungen werden NIE ueberschrieben — das
//     ist die invariante Schutzregel auch in der Pipeline.
//   - audit_eintrag pro angepasste Buchung mit aktion='konsistenz_pass' und
//     Vorher/Nachher-Details.
//   - Batches a 50 Updates: kein Risk eines Riesen-Transaktions-Pakets.
//
// Aufruf: `wendeKonsistenzPassAn(supabase, owner_id)` — wird in der
// /api/klassifizierung-Route NACH der Pipeline-Schleife getriggert, Phase 2
// desselben Jobs.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Klassifikation } from "@/lib/types";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export interface KonsistenzPassResultat {
  /** Anzahl unterschiedlicher Empfaenger, die ueberhaupt geprueft wurden. */
  empfaenger_geprueft: number;
  /** Anzahl Empfaenger, bei denen wenigstens 1 Buchung angepasst wurde. */
  empfaenger_angepasst: number;
  /** Anzahl tatsaechlich umgebogener Buchungen. */
  buchungen_angepasst: number;
  /**
   * Anzahl Empfaenger mit mehreren Kategorien, die der Pass NICHT angepasst
   * hat (zu kleine Mehrheit, gemischte Klassifikation, niedrige Konfidenz).
   */
  empfaenger_uneinheitlich: number;
}

interface BuchungRow {
  id: string;
  empfaenger_normalisiert: string | null;
  kategorie_id: string | null;
  klassifikation: Klassifikation | null;
  steuerrelevant: boolean | null;
  ust_satz: number | null;
  status: "offen" | "auto_verbucht" | "zur_pruefung" | "manuell_bestaetigt";
  konfidenz: number | null;
  pruef_grund: string | null;
}

const MIN_BUCHUNGEN_PRO_EMPFAENGER = 3;
const MIN_MEHRHEITSANTEIL = 0.6;
const MIN_AVG_KONFIDENZ = 0.85;
const UPDATE_BATCH_GROESSE = 50;

// Spalten-Auswahl konsistent in eine Konstante — gleicher Stil wie in den
// API-Routen (z. B. SELECT_BUCHUNG in /api/klassifizierung/route.ts).
const SELECT_BUCHUNG_FUER_PASS =
  "id, empfaenger_normalisiert, kategorie_id, klassifikation, " +
  "steuerrelevant, ust_satz, status, konfidenz, pruef_grund";

// ---------------------------------------------------------------------------
// Pure Helper: Mehrheits-Bestimmung
// ---------------------------------------------------------------------------

interface KategorieAggregat {
  kategorie_id: string;
  klassifikation: Klassifikation | null;
  steuerrelevant: boolean | null;
  ust_satz: number | null;
  anzahl: number;
  konfidenz_summe: number;
}

export interface MehrheitsEntscheidung {
  /** True, wenn der Pass diesen Empfaenger anpassen soll. */
  angepasst: boolean;
  /** Gruende fuer das Nicht-Anpassen (nur wenn angepasst=false). */
  grund?:
    | "zu_klein"
    | "konsistent"
    | "keine_mehrheit"
    | "konfidenz_zu_niedrig"
    | "mischklassifikation"
    | "keine_auto_verbucht";
  mehrheits_kategorie_id?: string;
  mehrheits_klassifikation?: Klassifikation | null;
  mehrheits_steuerrelevant?: boolean | null;
  mehrheits_ust_satz?: number | null;
  mehrheits_anzahl?: number;
  /** Gesamtanzahl an auto_verbuchten Buchungen dieses Empfaengers. */
  gesamt_auto?: number;
  avg_konfidenz_mehrheit?: number;
}

/**
 * REINE Funktion: bestimmt aus den Buchungen eines Empfaengers, ob und auf
 * welche Mehrheits-Kategorie der Pass angleichen soll.
 *
 * Beruecksichtigt fuer die Mehrheits-Berechnung NUR `auto_verbucht`-
 * Buchungen — `zur_pruefung`-Buchungen sind das Adressaten-Ziel, nicht der
 * Massstab. `manuell_bestaetigt`-Buchungen werden im Aufrufer bereits weg-
 * gefiltert (sie sind weder Massstab noch Ziel).
 *
 * Schritte:
 *  1. Zaehl-Aggregat ueber kategorie_id der auto_verbuchten Buchungen.
 *  2. Distinct kategorie_id zaehlen (>= 2 = es gibt eine Inkonsistenz).
 *  3. Top-Kategorie identifizieren, ihren Anteil + Durchschnitts-Konfidenz.
 *  4. Mischklassifikations-Check ueber ALLE Buchungen (auto + zur_pruefung):
 *     wenn dort 'privat' UND 'geschaeftlich' (oder eine andere Mischung von
 *     finalen Klassifikationen privat/geschaeftlich/neutral) gemischt
 *     vorkommen, sind wir raus.
 */
export function bestimmeMehrheit(
  buchungen: readonly BuchungRow[],
): MehrheitsEntscheidung {
  const auto = buchungen.filter((b) => b.status === "auto_verbucht");

  if (auto.length === 0) {
    return { angepasst: false, grund: "keine_auto_verbucht" };
  }

  // Kategorie-Aggregat ueber auto-verbuchte Buchungen.
  const aggMap = new Map<string, KategorieAggregat>();
  for (const b of auto) {
    if (!b.kategorie_id) continue;
    const cur = aggMap.get(b.kategorie_id);
    if (cur) {
      cur.anzahl++;
      cur.konfidenz_summe += b.konfidenz ?? 0;
    } else {
      aggMap.set(b.kategorie_id, {
        kategorie_id: b.kategorie_id,
        klassifikation: b.klassifikation,
        steuerrelevant: b.steuerrelevant,
        ust_satz: b.ust_satz,
        anzahl: 1,
        konfidenz_summe: b.konfidenz ?? 0,
      });
    }
  }

  // Distinct Kategorien (ALLE Buchungen mit kategorie_id, nicht nur auto).
  const distinctKategorien = new Set(
    buchungen.map((b) => b.kategorie_id).filter((k): k is string => !!k),
  );
  if (distinctKategorien.size < 2) {
    // Keine Inkonsistenz zu beheben.
    return { angepasst: false, grund: "konsistent" };
  }

  // Top-Aggregat ermitteln.
  let top: KategorieAggregat | null = null;
  for (const agg of aggMap.values()) {
    if (!top || agg.anzahl > top.anzahl) top = agg;
  }
  if (!top) {
    return { angepasst: false, grund: "keine_auto_verbucht" };
  }

  const anteil = top.anzahl / auto.length;
  if (anteil < MIN_MEHRHEITSANTEIL) {
    return {
      angepasst: false,
      grund: "keine_mehrheit",
      mehrheits_kategorie_id: top.kategorie_id,
      mehrheits_anzahl: top.anzahl,
      gesamt_auto: auto.length,
    };
  }

  const avgKonfidenz = top.konfidenz_summe / top.anzahl;
  if (avgKonfidenz < MIN_AVG_KONFIDENZ) {
    return {
      angepasst: false,
      grund: "konfidenz_zu_niedrig",
      mehrheits_kategorie_id: top.kategorie_id,
      mehrheits_anzahl: top.anzahl,
      gesamt_auto: auto.length,
      avg_konfidenz_mehrheit: avgKonfidenz,
    };
  }

  // Mischklassifikations-Check: wenn der Empfaenger gleichzeitig 'privat'
  // UND 'geschaeftlich' (oder 'neutral' + 'privat'/'geschaeftlich') unter
  // den auto-verbuchten oder zur-pruefung Buchungen hat, lassen wir die
  // Finger davon. PayPal-Fall: Mehrheits-Klassifikation 'privat', aber
  // einige Buchungen 'neutral' (Geldtransit) → wir greifen nicht ein.
  const klassifikationen = new Set(
    buchungen
      .map((b) => b.klassifikation)
      .filter((k): k is Klassifikation => !!k && k !== "unklar"),
  );
  if (klassifikationen.size > 1) {
    return {
      angepasst: false,
      grund: "mischklassifikation",
      mehrheits_kategorie_id: top.kategorie_id,
      mehrheits_anzahl: top.anzahl,
      gesamt_auto: auto.length,
      avg_konfidenz_mehrheit: avgKonfidenz,
    };
  }

  return {
    angepasst: true,
    mehrheits_kategorie_id: top.kategorie_id,
    mehrheits_klassifikation: top.klassifikation,
    mehrheits_steuerrelevant: top.steuerrelevant,
    mehrheits_ust_satz: top.ust_satz,
    mehrheits_anzahl: top.anzahl,
    gesamt_auto: auto.length,
    avg_konfidenz_mehrheit: avgKonfidenz,
  };
}

// ---------------------------------------------------------------------------
// Haupt-Eintrittspunkt
// ---------------------------------------------------------------------------

/**
 * Konsistenz-Pass: laeuft nach der Hauptklassifizierung als Phase 2.
 * Liest alle Buchungen des Owners mit Status `auto_verbucht` oder
 * `zur_pruefung`, gruppiert nach `empfaenger_normalisiert`, bestimmt fuer
 * jede Gruppe die Mehrheits-Kategorie und schreibt die nicht-konformen
 * Buchungen darauf um.
 *
 * - Manuell bestaetigte Buchungen werden NIE angefasst.
 * - Buchungen ohne `empfaenger_normalisiert` werden uebersprungen (keine
 *   Gruppen-Zuordnung moeglich).
 * - Empfaenger-Schwellwert: mind. MIN_BUCHUNGEN_PRO_EMPFAENGER und mind.
 *   2 distinct kategorie_id (sonst nix zu tun).
 * - Batches: bis zu UPDATE_BATCH_GROESSE Updates am Stueck pro Empfaenger.
 *   (Supabase JS-Client kennt keine Transaktionen; analog zu upsertKenntnis
 *   ist Audit best-effort.)
 *
 * Liefert Statistik fuer das UI / die API-Response.
 */
export async function wendeKonsistenzPassAn(
  supabase: SupabaseClient,
  owner_id: string,
): Promise<KonsistenzPassResultat> {
  const resultat: KonsistenzPassResultat = {
    empfaenger_geprueft: 0,
    empfaenger_angepasst: 0,
    buchungen_angepasst: 0,
    empfaenger_uneinheitlich: 0,
  };

  // (1) Alle nicht-manuell-bestaetigten Buchungen laden, in deren Gruppe
  // ueberhaupt eine Mehrheit gebildet werden koennte. Ein einzelner Pull
  // ueber alle Buchungen ist akzeptabel — selbst 10.000 Zeilen mit knapp
  // 10 Feldern sind < 1 MB. Skaliert das spaeter, kann man pro Empfaenger
  // einzeln laden, aber dafuer braucht es zuerst einen Index-getriebenen
  // distinct-Empfaenger-Listen-Query.
  const { data, error } = await supabase
    .from("buchung")
    .select(SELECT_BUCHUNG_FUER_PASS)
    .eq("owner_id", owner_id)
    .in("status", ["auto_verbucht", "zur_pruefung"])
    .not("empfaenger_normalisiert", "is", null)
    .limit(10000);

  if (error || !data) return resultat;

  // (2) Gruppieren nach empfaenger_normalisiert.
  const gruppen = new Map<string, BuchungRow[]>();
  for (const row of data as unknown as BuchungRow[]) {
    const key = (row.empfaenger_normalisiert ?? "").trim();
    if (key.length === 0) continue;
    const liste = gruppen.get(key);
    if (liste) {
      liste.push(row);
    } else {
      gruppen.set(key, [row]);
    }
  }

  // (3) Pro Gruppe Mehrheit bestimmen + ggf. anpassen.
  for (const [empfaengerNorm, buchungen] of gruppen) {
    if (buchungen.length < MIN_BUCHUNGEN_PRO_EMPFAENGER) {
      // Zu klein — fliesst in keine Statistik (auch nicht uneinheitlich).
      continue;
    }

    resultat.empfaenger_geprueft++;

    const entscheidung = bestimmeMehrheit(buchungen);
    if (!entscheidung.angepasst) {
      // "Konsistent" zaehlt nicht als uneinheitlich (war ja gar nichts zu
      // tun). Nur die echten Mehrkategorie-Faelle, bei denen der Pass
      // nichts macht, gehen in `empfaenger_uneinheitlich`.
      if (
        entscheidung.grund === "keine_mehrheit" ||
        entscheidung.grund === "konfidenz_zu_niedrig" ||
        entscheidung.grund === "mischklassifikation"
      ) {
        resultat.empfaenger_uneinheitlich++;
      }
      continue;
    }

    // Anzupassende Buchungen ermitteln: alles AUSSER manuell_bestaetigt UND
    // alles, dessen kategorie_id != Mehrheit. Priorisierung: Buchungen mit
    // pruef_grund='ki_nicht_verfuegbar' (LLM-Aussetzer aus Hebel A) zuerst.
    const ziel = buchungen.filter(
      (b) =>
        b.status !== "manuell_bestaetigt" &&
        b.kategorie_id !== entscheidung.mehrheits_kategorie_id,
    );
    if (ziel.length === 0) continue;

    ziel.sort((a, b) => {
      // ki_nicht_verfuegbar zuerst.
      const aPrio = a.pruef_grund === "ki_nicht_verfuegbar" ? 0 : 1;
      const bPrio = b.pruef_grund === "ki_nicht_verfuegbar" ? 0 : 1;
      return aPrio - bPrio;
    });

    let angepasstFuerEmpfaenger = 0;

    // (4) In Batches updaten — der Supabase-JS-Client kennt keine Trans-
    // aktion, jedes Update ist atomar fuer sich. Audit ist best-effort.
    for (let i = 0; i < ziel.length; i += UPDATE_BATCH_GROESSE) {
      const batch = ziel.slice(i, i + UPDATE_BATCH_GROESSE);
      for (const b of batch) {
        const neueKonfidenz = Math.max(
          b.konfidenz ?? 0,
          MIN_AVG_KONFIDENZ,
        );

        const { error: updErr } = await supabase
          .from("buchung")
          .update({
            kategorie_id: entscheidung.mehrheits_kategorie_id,
            klassifikation: entscheidung.mehrheits_klassifikation,
            steuerrelevant: entscheidung.mehrheits_steuerrelevant,
            ust_satz: entscheidung.mehrheits_ust_satz,
            status: "auto_verbucht",
            pruef_grund: null,
            konfidenz: neueKonfidenz,
            quelle: "ki",
            begruendung:
              "Konsistenz-Pass: an Mehrheits-Kategorie des Empfaengers angepasst.",
          })
          .eq("id", b.id)
          .eq("owner_id", owner_id)
          .neq("status", "manuell_bestaetigt");

        if (updErr) continue;

        angepasstFuerEmpfaenger++;
        resultat.buchungen_angepasst++;

        // Best-effort-Audit, analog upsertKenntnis. Fehler im Audit darf
        // den Pass nicht abbrechen.
        await supabase
          .from("audit_eintrag")
          .insert({
            owner_id,
            entitaet: "buchung",
            entitaet_id: b.id,
            aktion: "konsistenz_pass",
            quelle: "ki",
            details: {
              empfaenger_norm: empfaengerNorm,
              vorher_kategorie_id: b.kategorie_id,
              nachher_kategorie_id: entscheidung.mehrheits_kategorie_id,
              vorher_status: b.status,
              vorher_pruef_grund: b.pruef_grund,
              mehrheit_anzahl: entscheidung.mehrheits_anzahl,
              gesamt_anzahl: entscheidung.gesamt_auto,
              avg_konfidenz_mehrheit: entscheidung.avg_konfidenz_mehrheit,
            },
          })
          .then(
            () => undefined,
            () => undefined,
          );
      }
    }

    if (angepasstFuerEmpfaenger > 0) {
      resultat.empfaenger_angepasst++;
    }
  }

  return resultat;
}
