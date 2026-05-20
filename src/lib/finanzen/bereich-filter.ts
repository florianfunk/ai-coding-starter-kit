// Negativ-Listen-Ansatz für die Bereichs-Sicht.
//   'geschaeft' = strikt geschäftlich (für EÜR-relevante Auswertungen)
//   'privat'    = alles andere (privat, unklar, neutral, ohne Klassif.)
//   'alle'      = keine Einschränkung (komplette Konto-Sicht)
//
// Wir nutzen `klassifikation` als Primärsignal. Falls eine Buchung
// keine Klassifikation, aber eine Kategorie hat, leiten wir vom
// Kategorie-Typ ab (Einnahme/Ausgabe → geschäftlich; privat/neutral →
// privat). Buchungen ohne Klassifikation UND ohne (passende) Kategorie
// zählen zu "privat" im weiteren Sinne — pragmatisch, lässt sich später
// verfeinern.
//
// Hinweis Server-Filter: 'privat' lässt sich nicht sauber als einzelne
// SQL-WHERE-Klausel ausdrücken (Negation einer Verknüpfung), deshalb
// filtern wir Bereichs-Zugehörigkeit grundsätzlich in JS nach. 'geschaeft'
// erlaubt einen Pre-Filter auf der DB; den setzt der Aufrufer bei Bedarf.

import type { Bereich } from "@/lib/validation/kategorien-analyse";
import type { Klassifikation, KategorieTyp } from "@/lib/types";

/**
 * Kanonische Bereichs-Definition.
 *
 * - **geschaeftlich** = strikt geschäftlich (Klassif. 'geschaeftlich' oder
 *   Kategorie-Typ Einnahme/Ausgabe).
 * - **privat** = strikt privat (Klassif. 'privat' oder Kategorie-Typ
 *   'privat').
 * - **beidseitig sichtbar** = alles dazwischen (klassif. 'neutral'/
 *   'unklar', Kategorie-Typ 'neutral', ohne Kategorie und ohne
 *   Klassifikation). Erscheint in *beiden* Bereichs-Sichten, damit
 *   ungeklärte Buchungen nicht unsichtbar werden.
 */
export function istImBereich(
  b: {
    klassifikation: Klassifikation | null;
    kategorieTyp: KategorieTyp | null;
  },
  bereich: Bereich,
): boolean {
  if (bereich === "alle") return true;

  const istGeschaeft =
    b.klassifikation === "geschaeftlich" ||
    b.kategorieTyp === "einnahme" ||
    b.kategorieTyp === "ausgabe";
  const istPrivat = b.klassifikation === "privat" || b.kategorieTyp === "privat";

  if (bereich === "geschaeft") {
    // geschäftlich UND alles beidseitig sichtbar (= weder klar geschäftl.
    // noch klar privat)
    return istGeschaeft || !istPrivat;
  }
  // bereich === "privat"
  return istPrivat || !istGeschaeft;
}
