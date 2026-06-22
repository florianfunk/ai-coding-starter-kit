// PROJ-15 P1 — ReDoS-sicherer Regex-Compiler für Lernregel-Bedingungen.
//
// Nutzereingaben dürfen NICHT ungeprüft als Regex laufen (ReDoS-Risiko:
// "catastrophic backtracking" kann den Vercel-Runtime-Thread blockieren).
// `re2` wurde im Tech-Design bewusst verworfen (Native-Binding, nicht
// Edge-/Serverless-kompatibel). Stattdessen: ein statischer Linter, der die
// klassischen ReDoS-Konstrukte ablehnt, ein hartes 200-Zeichen-Limit und ein
// try/catch um `new RegExp`.
//
// Fail-safe: ist ein Muster ungültig oder unsicher, gibt `kompiliereWennSicher`
// `null` zurück — der Aufrufer behandelt das als "matcht NIE" (nicht als
// "matcht alles").

/** Hartes Längenlimit (Defense-in-Depth; DB-CHECK spiegelt das). */
export const MAX_REGEX_LAENGE = 200;

/**
 * Statischer ReDoS-Linter. Lehnt die bekannten "catastrophic backtracking"-
 * Konstrukte ab. Konservativ: im Zweifel `false` (lieber eine harmlose Regel
 * ablehnen als eine bösartige durchlassen).
 *
 * Abgelehnt werden:
 *  - Verschachtelte Quantoren: eine Gruppe, deren Inhalt selbst einen
 *    Quantor (`*`, `+`, `?`, `{n,}`) auf einem wiederholbaren Atom trägt,
 *    und die als Ganzes erneut quantifiziert wird — z. B. `(a+)+`, `(.*)*`,
 *    `(a*)+`, `(a+){2,}`.
 *  - Alternation direkt hinter einem Quantor: `(a|aa)+`, `(a|b|c)*` —
 *    überlappende Alternativen unter Wiederholung sind der klassische
 *    Worst-Case.
 *  - Backreferences unter Quantor: `(a)\1+`.
 */
export function istSicheresMuster(muster: string): boolean {
  if (typeof muster !== "string") return false;
  const m = muster.trim();
  if (m.length === 0 || m.length > MAX_REGEX_LAENGE) return false;

  // Quantor-Token nach einer schließenden Gruppe: ) gefolgt von * + ? oder {…}
  // (optional mit lazy/possessive Suffix). Wir prüfen den Inhalt JEDER Gruppe,
  // die als Ganzes quantifiziert wird.
  const gruppen = sammleQuantifizierteGruppen(m);
  for (const inhalt of gruppen) {
    // (a) Innerer Quantor auf wiederholbarem Atom → verschachtelter Quantor.
    if (enthaeltInnerenQuantor(inhalt)) return false;
    // (b) Alternation im wiederholten Gruppeninhalt → überlappendes Backtracking.
    if (enthaeltTopLevelAlternation(inhalt)) return false;
  }

  // (c) Backreference, gefolgt von einem Quantor: \1+ \2* …
  if (/\\[1-9]\d*\s*[*+?{]/.test(m)) return false;

  return true;
}

/**
 * Findet alle Gruppen `( … )`, die unmittelbar als Ganzes quantifiziert
 * werden, und liefert deren Inhalt zurück. Klammern-Tiefe wird mitgezählt,
 * escapte Klammern (`\(`) zählen nicht.
 */
function sammleQuantifizierteGruppen(m: string): string[] {
  const ergebnis: string[] = [];
  const stack: number[] = []; // Start-Index des Gruppeninhalts (nach "(")
  for (let i = 0; i < m.length; i++) {
    const c = m[i];
    if (c === "\\") {
      i++; // nächstes Zeichen ist escaped → überspringen
      continue;
    }
    if (c === "(") {
      stack.push(i + 1);
    } else if (c === ")") {
      const start = stack.pop();
      if (start === undefined) continue; // unbalanciert → RegExp wirft später
      // Was folgt direkt nach der schließenden Klammer?
      const next = m[i + 1];
      if (next === "*" || next === "+" || next === "?" || next === "{") {
        let inhalt = m.slice(start, i);
        // Non-capturing/lookaround-Präfixe abstreifen, der Quantor-Check
        // interessiert sich nur für den eigentlichen Inhalt.
        inhalt = inhalt.replace(/^\?[:=!<]?(?:[a-zA-Z]+>)?/, "");
        ergebnis.push(inhalt);
      }
    }
  }
  return ergebnis;
}

/**
 * Prüft, ob ein (Gruppen-)Inhalt selbst einen Quantor auf einem
 * wiederholbaren Atom trägt — der innere Teil eines verschachtelten Quantors.
 * Ein Quantor auf einem festen Zähler-Atom wie `a{2}` ist harmlos; gefährlich
 * ist die offene Wiederholung `* + {n,}` (und `?` in Kombination mit äußerer
 * Wiederholung).
 */
function enthaeltInnerenQuantor(inhalt: string): boolean {
  // Quantoren, die unbegrenztes Backtracking zulassen.
  // `*`, `+`, beliebiges `?`, und `{n,}` (offene Obergrenze).
  // Wir ignorieren escapte Quantoren (`\*`).
  let i = 0;
  while (i < inhalt.length) {
    const c = inhalt[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "*" || c === "+" || c === "?") {
      return true;
    }
    if (c === "{") {
      // {n,} oder {n,m} mit offener/großer Obergrenze → als Quantor zählen.
      const rest = inhalt.slice(i);
      if (/^\{\d*,\d*\}/.test(rest)) return true;
    }
    i++;
  }
  return false;
}

/** Prüft, ob der Gruppeninhalt auf oberster Ebene ein `|` enthält. */
function enthaeltTopLevelAlternation(inhalt: string): boolean {
  let tiefe = 0;
  for (let i = 0; i < inhalt.length; i++) {
    const c = inhalt[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === "(") tiefe++;
    else if (c === ")") tiefe--;
    else if (c === "[") {
      // Zeichenklasse überspringen — `|` darin ist literal.
      i++;
      while (i < inhalt.length && inhalt[i] !== "]") {
        if (inhalt[i] === "\\") i++;
        i++;
      }
    } else if (c === "|" && tiefe === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Kompiliert ein Nutzer-Muster case-insensitiv, ABER nur wenn es den
 * statischen Linter besteht und gültig ist. Sonst `null`.
 *
 * Der Aufrufer MUSS `null` als "matcht nicht" behandeln (fail-safe).
 */
export function kompiliereWennSicher(muster: string): RegExp | null {
  if (typeof muster !== "string") return null;
  const m = muster.trim();
  if (!istSicheresMuster(m)) return null;
  try {
    return new RegExp(m, "iu");
  } catch {
    try {
      // `u`-Flag kann an Altmustern scheitern (z. B. `\*` ist im u-Modus
      // erlaubt, aber andere Escapes nicht). Fallback ohne Unicode-Flag.
      return new RegExp(m, "i");
    } catch {
      return null;
    }
  }
}
