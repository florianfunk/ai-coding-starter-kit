// PROJ-15 — Stufe 0 der Klassifizierungs-Pipeline: Empfaenger-Normalisierung.
//
// Reine, deterministische Funktion (kein IO). Vereinheitlicht den Rohwert
// `buchung.empfaenger` so, dass nachgelagerte Schritte (Regeln, Cache,
// Historie, LLM) stabil treffen. „STRIPE*ACME LTD" und „Acme Ltd. (Berlin)"
// landen danach beide auf demselben Schluessel "acme".
//
// Bewusst Substring-/Wort-basierte Regeln statt freier Regex auf Nutzer-
// Eingaben: deterministisch, ReDoS-frei, debuggbar.
//
// Idempotent: normalisiereEmpfaenger(normalisiereEmpfaenger(x)) === normalisiereEmpfaenger(x)

/**
 * Payment-Provider-Praefixe, die vor dem eigentlichen Empfaenger stehen
 * koennen (z. B. Kartenabrechnung "STRIPE*ACME LTD" oder PayPal-Position
 * "PAYPAL *NETFLIX"). Trennzeichen nach dem Praefix kann `*`, ` ` oder
 * beides sein. Match ist case-insensitive, am Anfang oder hinter Whitespace.
 *
 * Reihenfolge: laengere Praefixe zuerst, damit "PADDLE.NET" nicht von
 * "PADDLE" geschluckt wird.
 */
const PAYMENT_PRAEFIXE = [
  "PADDLE.NET",
  "PADDLE",
  "STRIPE",
  "PAYPAL",
  "SP",
  "SQ",
  "PP",
  "IZ",
] as const;

/**
 * Rechtsformen, die am Ende des Empfaengernamens als eigenstaendiges Token
 * stehen koennen. Werden case-insensitive als ganzes Wort entfernt (mit oder
 * ohne abschliessenden Punkt). Reihenfolge: laengere Varianten zuerst,
 * damit "UG (haftungsbeschraenkt)" nicht von "UG" allein verstuemmelt wird.
 *
 * „DE", „EU", Laendercodes sind bewusst NICHT in der Liste — sie sind keine
 * Rechtsform und sollen erhalten bleiben (z. B. "Acme DE" bleibt "acme de").
 */
/**
 * Form-Literale werden OHNE Trailing-Punkt aufgelistet — der Regex erlaubt
 * den Trailing-Punkt optional. Damit matchen "Inc" und "Inc." gleichermassen,
 * und auch "B.V" ohne den letzten Punkt (Rand-Bereinigung kann ihn schon
 * abgeschnitten haben).
 *
 * Reihenfolge: laengere Varianten zuerst, damit "UG (haftungsbeschränkt)"
 * nicht von "UG" allein verstuemmelt wird und "GmbH & Co. KG" nicht von
 * "GmbH" zerteilt wird.
 */
const RECHTSFORMEN = [
  "UG (haftungsbeschränkt)",
  "UG (haftungsbeschraenkt)",
  "GmbH & Co. KG",
  "GmbH",
  "e.K",
  "e.V",
  "B.V",
  "S.A",
  "S.L",
  "Corp",
  "Inc",
  "Ltd",
  "Co",
  "AG",
  "KG",
  "OHG",
  "GbR",
  "UG",
  "LLC",
  "LLP",
  "BV",
  "SA",
  "SL",
] as const;

/**
 * Entfernt einen einzelnen Payment-Provider-Praefix am Anfang des Strings
 * (oder hinter fuehrendem Whitespace). Trennzeichen nach dem Praefix:
 * `*`, Whitespace oder beides. Gibt den unveraenderten String zurueck,
 * wenn kein Praefix passt.
 */
function entferneEinenPaymentPraefix(input: string): {
  rest: string;
  entfernt: boolean;
} {
  const trimLeading = input.replace(/^\s+/, "");
  const upper = trimLeading.toUpperCase();
  for (const praefix of PAYMENT_PRAEFIXE) {
    if (!upper.startsWith(praefix)) continue;
    // Nach dem Praefix muss ein Trennzeichen kommen (* oder Whitespace),
    // sonst ist es ein zufaelliges Wort-Anfang (z. B. "SPAREN" startet mit
    // "SP", soll aber NICHT als SP-Praefix gelten).
    const nach = trimLeading.slice(praefix.length);
    const match = nach.match(/^\s*\*\s*|^\s+/);
    if (!match) continue;
    return { rest: nach.slice(match[0].length), entfernt: true };
  }
  return { rest: trimLeading, entfernt: false };
}

/**
 * Entfernt Klammer-Ausdruecke am Ende, z. B. "Acme Ltd (Berlin)" → "Acme Ltd".
 * Mehrere geschachtelte oder mehrere End-Klammern werden in einer Schleife
 * iterativ entfernt — falls "Acme (DE) (Berlin)" auftaucht, fallen beide.
 */
function entferneEndKlammern(input: string): string {
  let aktuell = input;
  // Maximal 5 Iterationen — Sicherheitsnetz gegen pathologische Inputs.
  for (let i = 0; i < 5; i++) {
    const nach = aktuell.replace(/\s*\([^()]*\)\s*$/u, "");
    if (nach === aktuell) break;
    aktuell = nach.trimEnd();
  }
  return aktuell;
}

/**
 * Escapen fuer den Einsatz in einer Regex (z. B. "Co." enthaelt einen Punkt).
 */
function regexEscape(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Entfernt Rechtsform-Tokens. Match-Bedingungen:
 *   - case-insensitive
 *   - als ganzes Wort (Word-Boundary davor) — verhindert, dass „AGENTUR"
 *     von „AG" zerschnitten wird
 *   - mit oder ohne abschliessenden Punkt
 *   - optional fuehrendes Komma + Whitespace ("Acme, Inc.")
 *   - irgendwo im String, nicht nur am Ende — manche Datenquellen schreiben
 *     "Acme LLC USA". Wir entfernen "LLC", "USA" bleibt aber als Hinweis.
 *
 * Idempotenz: nach dem Entfernen wird Mehrfach-Whitespace zusammengezogen,
 * sodass ein zweiter Durchlauf nichts mehr findet.
 */
function entferneRechtsformen(input: string): string {
  let aktuell = input;
  for (const form of RECHTSFORMEN) {
    const literal = regexEscape(form);
    // Match-Bedingungen:
    //   - Wortgrenze davor: Start-of-String, Whitespace oder Komma
    //   - optional ein abschliessender Punkt (z. B. "Inc" und "Inc." beide)
    //   - Wortgrenze danach: End-of-String, Whitespace oder Komma
    const muster = new RegExp(
      `(^|[\\s,])${literal}\\.?(?=\\s|$|,)`,
      "gi",
    );
    aktuell = aktuell.replace(muster, " ");
  }
  return aktuell;
}

/**
 * Schneidet Sonderzeichen am Rand ab und kollabiert Mehrfach-Whitespace.
 * Buchstaben (inkl. Umlaute), Ziffern, Bindestriche und Punkte im Inneren
 * bleiben erhalten — "Müller-Lüdenscheidt" und "S3" sind valide Namen.
 */
function bereinigeRaender(input: string): string {
  return input
    // Mehrfach-Whitespace → ein Space
    .replace(/\s+/g, " ")
    // Randzeichen, die keine Buchstaben/Ziffern sind, abschneiden
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .trim();
}

/**
 * Normalisiert einen Empfaenger-Rohwert zu einem stabilen Cache-/Vergleichs-
 * Schluessel.
 *
 * Pipeline:
 *   1. null/undefined/leer → ""
 *   2. Alle Payment-Praefixe entfernen (mehrfach, bis nichts mehr passt)
 *   3. End-Klammern entfernen
 *   4. Rechtsformen entfernen
 *   5. Mehrfach-Whitespace, Rand-Sonderzeichen aufraeumen
 *   6. toLocaleLowerCase("de-DE") — wichtig fuer Umlaute (I → i, Ü → ü)
 *
 * Idempotent: f(f(x)) === f(x). Wirft nie — leere/komische Eingaben
 * landen einfach als "".
 */
export function normalisiereEmpfaenger(
  raw: string | null | undefined,
): string {
  if (raw == null) return "";
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (trimmed === "") return "";

  // 1. Payment-Praefixe wiederholt entfernen (z. B. "STRIPE*PAYPAL *NETFLIX").
  let aktuell = trimmed;
  for (let i = 0; i < 5; i++) {
    const { rest, entfernt } = entferneEinenPaymentPraefix(aktuell);
    aktuell = rest;
    if (!entfernt) break;
  }

  // 2. End-Klammern ZUERST entfernen, BEVOR die Rand-Bereinigung die
  //    schliessende ')' abschneiden wuerde. Sonst stuende danach
  //    "Acme GmbH (DE" und die Klammer-Stufe finded keinen passenden
  //    Block mehr.
  aktuell = entferneEndKlammern(aktuell);

  // 3. Rand-Sonderzeichen abschneiden (fuehrend & nachlaufend) — damit die
  //    Rechtsform-Wortgrenze fuer Eingaben wie "---Acme GmbH---" greift.
  aktuell = bereinigeRaender(aktuell);

  // 4. Rechtsformen.
  aktuell = entferneRechtsformen(aktuell);

  // 5. Nochmal End-Klammern — wenn eine Klammer erst nach Wegfall der
  //    Rechtsform ans Ende rutscht ("Acme (Tochter) GmbH" → "Acme (Tochter)").
  aktuell = entferneEndKlammern(aktuell);

  // 6. Whitespace + Rand erneut aufraeumen (Rechtsformen hinterlassen Spaces).
  aktuell = bereinigeRaender(aktuell);

  // 7. Locale-aware lowercase fuer Umlaute.
  return aktuell.toLocaleLowerCase("de-DE");
}
