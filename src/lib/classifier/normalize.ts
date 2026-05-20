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
  // FR / LU — PayPal- und Amazon-Muster. Reihenfolge: laengere Varianten
  // ZUERST, damit "S.a.r.l. et Cie" nicht von "S.a.r.l" zerschnitten wird.
  "S.a.r.l. et Cie",
  "S.A.R.L. et Cie",
  "S.a r.l. et Cie",
  "S.A.R.L",
  "S.a.r.l",
  "S.a r.l",
  "Aktiengesellschaft",
  "e.K",
  "e.V",
  "B.V",
  "S.A",
  "S.L",
  "S.C.A",
  "S.A.S",
  "Corp",
  "Inc",
  "Ltd",
  "Co",
  "AG",
  "AB",
  "KG",
  "OHG",
  "GbR",
  "UG",
  "LLC",
  "LLP",
  "BV",
  "SA",
  "SL",
  "SCA",
  "SAS",
  "SARL",
  "Sarl",
  "et Cie",
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
  praefix: (typeof PAYMENT_PRAEFIXE)[number] | null;
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
    return { rest: nach.slice(match[0].length), entfernt: true, praefix };
  }
  return { rest: trimLeading, entfernt: false, praefix: null };
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
 * Strassen-/Adress-Tokens am Ende. Wortbestandteile, die typische deutsche
 * Strassennamen bilden. Match: case-insensitive, als Wort-Endung oder als
 * eigenstaendiges Wort am Ende.
 *
 * Reihenfolge: laengere Varianten zuerst (strasse vor str.).
 */
const STRASSEN_SUFFIXE = [
  "strasse",
  "straße",
  "str.",
  "str",
  "weg",
  "platz",
  "allee",
  "gasse",
  "ring",
  "damm",
  "boulevard",
] as const;

/**
 * Entfernt Adressbestandteile, die NACH der eigentlichen Firmenbezeichnung
 * angehaengt sind. Iterativ, bis kein Pattern mehr greift.
 *
 * Erkannte Patterns (alle am ENDE des Strings, case-insensitive):
 *   1. PLZ + Ort: `(?:^|[\s,])\d{5}\s+\S+$`
 *      → "60549 frankfurt" am Ende verschwindet
 *   2. Hausnummer am Ende: `\s+\d+\s*[a-z]?$` (z. B. "36", "12a")
 *   3. Strassenname-Token: ein Wort, das auf `strasse`, `str.`, `weg`, ...
 *      endet, am Ende des Strings
 *   4. Komma-getrennte End-Adresse: alles ab dem letzten ", \d..." bis
 *      Ende abschneiden, wenn dort eine PLZ oder Hausnummer erscheint
 *
 * Maximal 5 Iterationen Sicherheitsnetz.
 */
function entferneAdresseAmEnde(input: string): string {
  let aktuell = input;
  const strassenAlt = STRASSEN_SUFFIXE.map(regexEscape).join("|");
  for (let i = 0; i < 5; i++) {
    const vor = aktuell;

    // 1) Komma-getrennte End-Adresse: ", 22-24 Boulevard Royal, 2449 Luxembourg"
    //    → Alles ab Komma + Hausnummer am Anfang des Restes abschneiden.
    //    Bewusst eng gefasst: das erste Stueck nach dem Komma muss mit einer
    //    Ziffer beginnen (Hausnr. oder PLZ), damit "Acme, Software" nicht
    //    abgeschnitten wird.
    aktuell = aktuell.replace(/\s*,\s*\d[^,]*(?:,[^,]*)*\s*$/u, "");

    // 2) PLZ + Ort am Ende: " 10249 Berlin"
    aktuell = aktuell.replace(/[\s,]+\d{5}\s+\S+\s*$/u, "");

    // 3) Hausnummer (auch mit Bindestrich `22-24` oder Buchstabe `12a`)
    //    PLUS adress-typische Folge-Tokens (Strassenwort oder ein Wort, das
    //    ein Strassen-Suffix endet). Pattern: ` 22-24 Boulevard Royal` am
    //    Ende → komplett weg.
    //
    //    Bewusst NICHT: "Hausnummer + beliebige Tokens" — sonst wuerde
    //    "Acme 123 Software" auch beschnitten.
    aktuell = aktuell.replace(
      new RegExp(
        `\\s+\\d+(?:-\\d+)?[a-z]?(?:\\s+\\S+)*?(?:\\s+(?:${strassenAlt}))(?:\\s+\\S+)*\\s*$`,
        "iu",
      ),
      "",
    );

    // 4) Strassenname-Token am Ende (auch als Wort-Endung):
    //    "Dornhofstr." oder "Otto-Ostrowski-Strase" oder "Boulevard Royal".
    //    Pattern: Wortgrenze davor, dann beliebige Buchstaben + Suffix.
    //    Zusaetzlich: ein Strassen-Suffix-WORT alleine (z. B. "Boulevard"
    //    wenn der davorstehende Adressteil entfernt wurde) am Ende.
    aktuell = aktuell.replace(
      new RegExp(`\\s+\\S*(?:${strassenAlt})(?:\\s+\\S+)*\\s*$`, "iu"),
      "",
    );

    // 5) Hausnummer am Ende OHNE Strassennachbarwort: " 36" oder " 12a"
    //    oder " 7". Wichtig: nur EINE Zahl + optional Buchstabe; eine Zahl
    //    in der MITTE eines Namens ("S3") wird nicht angegriffen, da
    //    `\s+` davor noetig ist.
    aktuell = aktuell.replace(/\s+\d+(?:-\d+)?\s*[a-zA-Z]?\s*$/u, "");

    // 6) Rand-Whitespace und Trail-Komma trimmen, sonst greifen die naechsten
    //    Iterationen nicht.
    aktuell = aktuell.replace(/[\s,]+$/u, "").trimEnd();

    if (aktuell === vor) break;
  }
  return aktuell;
}

/**
 * Entfernt einen einzelnen Laendercode-Token am Ende des normalisierten
 * Strings, wenn davor noch mindestens ein weiteres Wort steht. So bleibt
 * "acme de" → "acme", aber ein einzelnes "de" wird nicht geschluckt.
 */
const LAENDERCODES_SUFFIX = ["DE", "EU", "INT", "INTERNATIONAL"] as const;

function entferneLaendercodeSuffix(input: string): string {
  for (const code of LAENDERCODES_SUFFIX) {
    const literal = regexEscape(code);
    // Vorsichtige Bedingung: mindestens EIN Wort davor (`\S+\s+`), dann der
    // Code am Ende (case-insensitive). Damit faellt "acme de" auf "acme",
    // ein blosses "de" bleibt erhalten.
    const muster = new RegExp(`(\\S+\\s+)${literal}\\s*$`, "iu");
    const nach = input.replace(muster, "$1");
    if (nach !== input) {
      return nach.trimEnd();
    }
  }
  return input;
}

/**
 * „Markennamen-Verdichtung" fuer Multi-Entity-Konzerne. Wenn der Eingabe-
 * String mit einem Konzern-Marker beginnt (gefolgt von Whitespace oder
 * Ende-of-String), wird er auf den Marker reduziert. Aggressive
 * Verdichtung — bewusst.
 *
 * Beispiel: "amazon payments europe" → "amazon",
 *           "amazon business eu" → "amazon",
 *           "amazon" → "amazon" (unveraendert),
 *           "amazonas reisen" → "amazonas reisen" (Wortgrenze schuetzt).
 *
 * Reihenfolge: spezifischer zuerst, damit "amazon" als kuerzeres Praefix
 * nicht "american express" matcht. (Wortgrenze `\s|$` macht das eigentlich
 * unmoeglich, aber explizit ist besser.)
 */
const KONZERN_MARKER = [
  "american express",
  "amazon",
  "google",
  "apple",
  "microsoft",
  "paypal",
  // Markennamen, die als erstes Wort stehen und vom Rest des
  // Firmen-Klartexts (Branche / Adresse) gefolgt werden. Wenn der
  // normalisierte String mit einem dieser Marker beginnt, schneiden
  // wir alles dahinter ab.
  "skandia",
  "strato",
  "klarna",
  "enercity",
] as const;

function verdichteKonzern(input: string): string {
  for (const marker of KONZERN_MARKER) {
    const literal = regexEscape(marker);
    // Match: String beginnt mit dem Marker, danach Whitespace oder String-Ende.
    // Wortgrenze schuetzt vor "amazonas reisen".
    const muster = new RegExp(`^${literal}(\\s|$)`, "i");
    if (muster.test(input)) {
      return marker;
    }
  }
  return input;
}

/**
 * Reduziert `enercity / enercity ...` auf `enercity` — wenn vor und nach
 * dem Slash dasselbe Wort steht, nimm das Wort einmal.
 *
 * Pattern: `wort / wort...` mit identischem fuehrenden Wort vor und nach
 * dem Slash. Whitespace-tolerant. Greift nur einmal — bei verschachtelten
 * Konstrukten muesste der Aufrufer iterieren.
 */
function reduziereSlashDuplikat(input: string): string {
  const m = input.match(/^(\S+)\s*\/\s*(\S+)(?:\s+(.*))?$/u);
  if (!m) return input;
  const links = m[1];
  const rechts = m[2];
  const rest = m[3] ?? "";
  if (links.toLowerCase() !== rechts.toLowerCase()) return input;
  return rest.trim() === "" ? links : `${links} ${rest}`.trim();
}

/**
 * Markennamen-Fallback fuer den Fall, dass nach allen Normalisierungs-
 * Schritten kein sinnvoller Rest mehr uebrig ist und der Original-Input
 * mit einem Payment-/Konzern-Praefix begann, der eigentlich SELBST der
 * Empfaenger war (z. B. "PayPal Europe S.a.r.l. ..." — hier ist PayPal
 * selbst die Firma, nicht ein Durchlauf wie "PAYPAL *NETFLIX").
 *
 * Heuristik: wenn der Empfaenger-Rest leer oder rein generisch ist
 * ("europe", "international", "deutschland", "germany"), dann setze
 * das Ergebnis auf den Marken-Namen des urspruenglich gestrippten
 * Praefix.
 */
const GENERISCHE_REGION_REST = new Set([
  "",
  "europe",
  "european",
  "international",
  "deutschland",
  "germany",
  "eu",
  "de",
  "ireland",
  "uk",
  "usa",
]);

/**
 * Generische Tokens, die in Kombination mit Region-Tokens als "Rest ist
 * nur Region/Branche, der eigentliche Marken-Name war der Praefix"
 * gewertet werden. Wird nur in `istGenerischerRest` benutzt, indem wir
 * den Rest in Tokens splitten und pruefen, ob ALLE Tokens generisch sind.
 */
const GENERISCHE_REGION_TOKENS = new Set<string>([
  "europe",
  "european",
  "international",
  "deutschland",
  "germany",
  "eu",
  "de",
  "ireland",
  "uk",
  "usa",
  "payments",
  "services",
  "holdings",
  "global",
  "world",
]);

function istGenerischerRest(normalisiert: string): boolean {
  if (GENERISCHE_REGION_REST.has(normalisiert)) return true;
  // Token-Pruefung: jeder Token muss generisch sein. Punkte/Kommas raus.
  const tokens = normalisiert
    .split(/\s+/)
    .map((t) => t.replace(/[.,;:!?]/g, ""))
    .filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every((t) => GENERISCHE_REGION_TOKENS.has(t));
}

/**
 * Mappt einen Payment-Praefix-Token (z. B. "PAYPAL") auf den Marken-Schluessel
 * im Cache-Format ("paypal"). Gibt `null` zurueck, wenn der Praefix kein
 * eigenstaendiger Markenname ist (z. B. "SP", "PP", "IZ" — die sind reine
 * Acquirer-Codes ohne stehende Marke).
 */
const PAYMENT_PRAEFIX_MARKENNAME: Record<string, string | null> = {
  "PADDLE.NET": "paddle",
  PADDLE: "paddle",
  STRIPE: "stripe",
  PAYPAL: "paypal",
  SP: null,
  SQ: null,
  PP: null,
  IZ: null,
};

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

  // 1. Payment-Praefixe wiederholt entfernen. Wir merken uns den ERSTEN
  //    gestrippten Praefix als moeglichen Marken-Fallback (z. B. wenn
  //    "PayPal Europe S.a.r.l." nach allen Schritten leer wird — dann
  //    war PayPal selbst der Empfaenger).
  let aktuell = trimmed;
  let markenFallback: string | null = null;
  for (let i = 0; i < 5; i++) {
    const { rest, entfernt, praefix } = entferneEinenPaymentPraefix(aktuell);
    aktuell = rest;
    if (!entfernt) break;
    if (markenFallback === null && praefix != null) {
      const marker = PAYMENT_PRAEFIX_MARKENNAME[praefix];
      if (marker != null) markenFallback = marker;
    }
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

  // 6. Adressen am Ende entfernen (PLZ, Hausnummer, Strassennamen, komma-
  //    getrennte Adress-Suffixe). Macht aus "Strato GmbH Otto-Ostrowski-
  //    Strase 7, 10249 Berlin" → "Strato".
  aktuell = entferneAdresseAmEnde(aktuell);

  // 7. Nach dem Adress-Entfernen kann erneut eine Rechtsform am Ende
  //    auftauchen (z. B. wenn die Adresse direkt nach der Rechtsform stand
  //    und ein Komma die Trennung war). Daher zweiter Rechtsform-Pass.
  aktuell = entferneRechtsformen(aktuell);

  // 8. Whitespace + Rand erneut aufraeumen.
  aktuell = bereinigeRaender(aktuell);

  // 9. Slash-Duplikat reduzieren ("enercity / enercity" → "enercity").
  aktuell = reduziereSlashDuplikat(aktuell);

  // 10. Locale-aware lowercase fuer Umlaute.
  aktuell = aktuell.toLocaleLowerCase("de-DE");

  // 11. Laendercode-Suffix entfernen, wenn davor mindestens ein Wort steht.
  //     "acme de" → "acme", aber alleinstehendes "de" bleibt.
  aktuell = entferneLaendercodeSuffix(aktuell);

  // 12. Konzern-Verdichtung: "amazon payments europe" → "amazon".
  aktuell = verdichteKonzern(aktuell);

  // 13. Marken-Fallback: wenn nach allen Schritten kein sinnvoller Rest
  //     uebrig ist und der Original-Input einen Payment-/Marken-Praefix
  //     hatte, der eine eigenstaendige Marke ist (PayPal, Stripe, Paddle),
  //     setze auf diesen Marken-Namen.
  if (markenFallback != null && istGenerischerRest(aktuell)) {
    return markenFallback;
  }

  return aktuell;
}
