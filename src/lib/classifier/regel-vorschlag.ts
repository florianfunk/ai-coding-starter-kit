// PROJ-7 — Regel-Vorschlag für die Prüflisten-Entscheidung.
//
// Aus den gerade zu entscheidenden Buchungen wird ein Vorschlag für eine
// Lernregel abgeleitet: ein stabiles Empfänger-Muster (und ersatzweise ein
// Zweck-Muster), das künftige Buchungen desselben Empfängers automatisch
// gleich verbucht.
//
// WICHTIG für die Trefferlogik (siehe classifier/rules.ts): Regeln matchen per
// case-insensitive Substring ("contains") auf dem ROHEN `empfaenger` bzw.
// `verwendungszweck`. Der Vorschlag muss daher ein echter Teilstring des
// Rohwerts bleiben — wir kürzen ausschließlich an den RÄNDERN (führende
// Payment-Präfixe wie "PayPal *", nachlaufende Transaktions-/Referenz-IDs),
// niemals in der Mitte. Sonst würde die erzeugte Regel die Buchung, aus der
// sie stammt, gar nicht treffen.
//
// Reine, deterministische Funktion ohne IO.

export interface RegelVorschlag {
  empfaenger_muster: string;
  zweck_muster: string;
  bezeichnung: string;
}

// Führende Payment-Provider-Präfixe einer Durchlauf-Position (Karte/PayPal),
// z. B. "PAYPAL *NETFLIX" oder "STRIPE*ACME". Das `*` ist das verlässliche
// Durchlauf-Signal — nur dann ist der eigentliche Empfänger der Teil DAHINTER.
// Ohne `*` (z. B. "PayPal Europe S.a.r.l.") ist der Provider selbst der
// Empfänger und darf NICHT abgeschnitten werden.
const PAYMENT_PRAEFIX_REGEX =
  /^(?:paddle\.net|paddle|stripe|paypal|sp|sq|pp|iz)\s*\*\s*/i;

/**
 * Längste gemeinsame Teilzeichenkette (case-insensitive) über alle Werte.
 * Rückgabe in Original-Schreibweise der kürzesten Eingabe. Bei einem einzigen
 * Wert wird dieser unverändert zurückgegeben; sind alle Werte gleich, ist das
 * Ergebnis der ganze (geteilte) String.
 *
 * Die kürzeste Eingabe dient als Basis — jede ihrer Teilketten wird von der
 * längsten zur kürzesten geprüft, bis eine in allen anderen vorkommt.
 */
export function gemeinsameTeilzeichenkette(werte: readonly string[]): string {
  if (werte.length === 0) return "";
  if (werte.length === 1) return werte[0];

  const basis = werte.reduce((a, b) => (b.length < a.length ? b : a));
  const basisLower = basis.toLowerCase();
  const andereLower = werte
    .filter((w) => w !== basis)
    .map((w) => w.toLowerCase());
  if (andereLower.length === 0) return basis; // alle identisch

  for (let len = basis.length; len >= 1; len--) {
    for (let start = 0; start + len <= basis.length; start++) {
      const subLower = basisLower.slice(start, start + len);
      if (subLower.trim().length === 0) continue;
      if (andereLower.every((w) => w.includes(subLower))) {
        return basis.slice(start, start + len);
      }
    }
  }
  return "";
}

/**
 * Entfernt nachlaufende, volatile Tokens (Transaktions-/Referenz-IDs). Ein
 * Token am Ende mit ≥ 3 Ziffern gilt als instabil und wird abgeschnitten —
 * iterativ, solange das letzte Token diese Bedingung erfüllt. Mindestens ein
 * Token bleibt stehen.
 */
function entferneVolatileEndTokens(input: string): string {
  const tokens = input.split(/\s+/).filter(Boolean);
  while (tokens.length > 1) {
    const letztes = tokens[tokens.length - 1];
    const ziffern = (letztes.match(/\d/g) ?? []).length;
    if (ziffern >= 3) tokens.pop();
    else break;
  }
  return tokens.join(" ");
}

/**
 * Bereinigt einen Muster-Kandidaten an den Rändern, sodass er ein stabiles,
 * aber weiterhin als Teilstring im Rohwert enthaltenes Muster ergibt:
 *   1. führenden Payment-Präfix ("PayPal *", "STRIPE*", …) entfernen
 *   2. nachlaufende ID-/Referenz-Tokens entfernen
 *   3. Rand-Sonderzeichen abschneiden
 */
export function bereinigeMusterRand(roh: string): string {
  let s = roh.trim();
  s = s.replace(PAYMENT_PRAEFIX_REGEX, "");
  s = entferneVolatileEndTokens(s);
  // Rand-Sonderzeichen (keine Buchstaben/Ziffern) abschneiden.
  s = s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").trim();
  return s;
}

/**
 * Leitet aus den zu entscheidenden Buchungen einen Regel-Vorschlag ab.
 *
 * Primär wird auf den Empfänger abgestellt ("Buchungen von diesem Empfänger
 * immer gleich verbuchen"). Nur wenn kein brauchbares Empfänger-Muster
 * gefunden wird, dient der Verwendungszweck als Fallback — so bleibt die Regel
 * möglichst wenig einschränkend.
 *
 * Ein Muster gilt erst ab 3 Zeichen als brauchbar.
 */
export function schlageRegelVor(
  faelle: ReadonlyArray<{
    empfaenger?: string | null;
    verwendungszweck?: string | null;
  }>,
): RegelVorschlag {
  const empfaenger = faelle
    .map((f) => (f.empfaenger ?? "").trim())
    .filter(Boolean);
  const zwecke = faelle
    .map((f) => (f.verwendungszweck ?? "").trim())
    .filter(Boolean);

  const empfKern = bereinigeMusterRand(gemeinsameTeilzeichenkette(empfaenger));
  const empfaenger_muster = empfKern.length >= 3 ? empfKern : "";

  let zweck_muster = "";
  if (!empfaenger_muster) {
    const zweckKern = bereinigeMusterRand(gemeinsameTeilzeichenkette(zwecke));
    if (zweckKern.length >= 3) zweck_muster = zweckKern;
  }

  const basis = empfaenger_muster || zweck_muster;
  const bezeichnung = basis ? `${basis} automatisch` : "Neue Regel";

  return { empfaenger_muster, zweck_muster, bezeichnung };
}
