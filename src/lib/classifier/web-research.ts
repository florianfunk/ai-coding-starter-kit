// PROJ-5 — Web-Recherche-Fallback (nur serverseitig).
//
// Wird gerufen, wenn die LLM-Klassifizierung unsicher ist (Konfidenz <
// Schwellwert) oder der Empfänger unbekannt wirkt. Ruft Firecrawl Search
// auf, holt 3 kurze Snippets über den Empfängernamen und liefert sie als
// kompakten Kontext für einen zweiten LLM-Aufruf zurück.
//
// DSGVO: An Firecrawl geht NUR der Empfängername (öffentliche Firmen-/
// Markendaten). KEIN Verwendungszweck, KEIN Betrag, KEINE Kontodaten.
//
// Failure-Modus: Bei jedem Fehler (kein Key, Timeout, Quote, leere
// Antwort) liefert die Funktion `null`. Die Pipeline darf darauf keine
// Klassifizierung stützen — sie geht stattdessen in die Prüfliste.

import Firecrawl from "@mendable/firecrawl-js";

export interface WebRechercheTreffer {
  /** Anzeigename der Quelle (z. B. Domain oder Titel). */
  titel: string;
  /** Kurzer Snippet-Text (in der Regel Meta-Description). */
  beschreibung: string;
  url: string;
}

export interface WebRechercheErgebnis {
  /** Verwendete Suchanfrage (Audit). */
  query: string;
  treffer: WebRechercheTreffer[];
}

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Sucht den Empfängernamen + 'Deutschland' und liefert Top-Treffer.
 * Liefert `null` bei jedem Fehler (kein Werfen — Recherche ist optional).
 *
 * @param empfaenger Empfängername (Pflicht). Leerstrings/null → null.
 * @param opts.timeoutMs Optionaler Timeout (Default 8s).
 */
export async function rechercheEmpfaenger(
  empfaenger: string | null,
  opts: { timeoutMs?: number } = {},
): Promise<WebRechercheErgebnis | null> {
  const name = (empfaenger ?? "").trim();
  if (name.length < 3) return null;

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  // Empfängernamen aus MoneyMoney enthalten oft Adresse/Straße — wir
  // schneiden auf die ersten ~80 Zeichen, das LLM-Signal ist im Namen.
  const queryName = name.slice(0, 80).replace(/\s+/g, " ").trim();
  const query = `${queryName} Deutschland Unternehmen Branche`;

  const client = new Firecrawl({ apiKey });

  // Eigener Timeout — das SDK hat keine harte Default-Grenze.
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const result = await client.search(query, {
      limit: 3,
      sources: [{ type: "web" }],
    });
    clearTimeout(timer);

    const web = (result as { web?: unknown[] }).web;
    if (!Array.isArray(web) || web.length === 0) return null;

    const treffer: WebRechercheTreffer[] = web
      .map((eintrag) => {
        const e = eintrag as {
          title?: string;
          description?: string;
          url?: string;
        };
        return {
          titel: typeof e.title === "string" ? e.title.slice(0, 200) : "",
          beschreibung:
            typeof e.description === "string"
              ? e.description.slice(0, 400)
              : "",
          url: typeof e.url === "string" ? e.url : "",
        };
      })
      .filter((t) => t.url !== "");

    if (treffer.length === 0) return null;
    return { query, treffer };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Formatiert Recherche-Ergebnis als kompakten Klartext-Block für das LLM.
 * Reine Funktion — kein IO.
 */
export function formatiereRechercheKontext(
  ergebnis: WebRechercheErgebnis,
): string {
  const zeilen = ergebnis.treffer.map((t, i) => {
    const titel = t.titel || new URL(t.url).hostname;
    return `${i + 1}. ${titel} — ${t.beschreibung}`;
  });
  return [
    `Web-Recherche zum Empfänger (Suchanfrage: "${ergebnis.query}"):`,
    ...zeilen,
  ].join("\n");
}
