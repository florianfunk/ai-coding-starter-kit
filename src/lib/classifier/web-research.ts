// PROJ-5 / PROJ-15 — Web-Recherche-Wrapper (nur serverseitig).
//
// Wird gerufen, wenn die LLM-Klassifizierung unsicher ist (Konfidenz <
// Schwellwert) oder der Empfänger unbekannt wirkt. Ruft Firecrawl Search
// auf, holt 3 kurze Snippets über den Empfängernamen und liefert sie als
// kompakten Kontext für einen zweiten LLM-Aufruf zurück.
//
// PROJ-15-Erweiterung: `extrahiereBrancheUndLeistung` macht einen
// zusätzlichen kleinen LLM-Call und destilliert aus den drei Snippets
// eine kompakte Branche + Leistung — beides wird mit in den Cache
// geschrieben, damit die LLM-Klassifikation in Folgeläufen besseren
// Kontext sieht.
//
// DSGVO: An Firecrawl geht NUR der Empfängername (öffentliche Firmen-/
// Markendaten). KEIN Verwendungszweck, KEIN Betrag, KEINE Kontodaten.
//
// Failure-Modus: Bei jedem Fehler (kein Key, Timeout, Quote, leere
// Antwort) liefert die Funktion `null`. Die Pipeline darf darauf keine
// Klassifizierung stützen — sie geht stattdessen in die Prüfliste.

import Firecrawl from "@mendable/firecrawl-js";
import { createGateway, generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { ladeAiKey } from "@/lib/admin/ai-key";

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

// ---------------------------------------------------------------------------
// PROJ-15 — Branche/Leistung-Extraktion via kleinem LLM-Call
// ---------------------------------------------------------------------------

const EXTRAKT_TIMEOUT_MS = 5000;

export interface BrancheUndLeistung {
  branche: string | null;
  leistung: string | null;
}

/**
 * Zod-Schema fuer die Antwort der Branche/Leistung-Extraktion.
 *
 * Beide Felder sind nullable: wenn die Snippets keine eindeutige Auskunft
 * geben, soll das LLM explizit `null` zurueckgeben, statt zu raten oder
 * einen leeren String zu produzieren.
 */
const brancheLeistungSchema = z.object({
  branche: z
    .string()
    .min(1)
    .max(60)
    .nullable()
    .describe("1-3 Worte, z. B. 'Online-Versandhandel'. null wenn unklar."),
  leistung: z
    .string()
    .min(1)
    .max(100)
    .nullable()
    .describe(
      "Ein knapper Satz, max. 100 Zeichen. null wenn aus den Snippets nicht klar.",
    ),
});

/**
 * Spiegelt das Provider-Wahl-Pattern aus `lib/classifier/llm.ts`:
 * - `sk-ant-…` → direkter Anthropic-Provider, Modell-Slug normalisiert
 * - sonst → Vercel AI Gateway
 */
function wahleProviderFuerExtraktion(
  key: string,
  modell: string,
): LanguageModel {
  if (key.startsWith("sk-ant-")) {
    const anthropic = createAnthropic({ apiKey: key });
    const normalisiert = modell
      .replace(/^anthropic\//, "")
      .replace(/\./g, "-");
    return anthropic(normalisiert);
  }
  const gateway = createGateway({ apiKey: key });
  return gateway(modell);
}

/**
 * Destilliert aus den drei Web-Snippets eine kompakte Branche + Leistung
 * fuer den Empfaenger-Cache.
 *
 * Robust by design: wirft NIE. Bei jedem Fehler (kein Key, Timeout,
 * Schema-Bruch, leere Antwort) → `null`. Die Pflege des Caches darf den
 * Klassifikations-Pfad nicht abbrechen.
 *
 * @param snippets        Drei Treffer aus `rechercheEmpfaenger`.
 * @param empfaengername  Rohname des Empfaengers (nur als Prompt-Kontext).
 * @param opts.timeoutMs  Optionaler Timeout (Default 5s).
 */
export async function extrahiereBrancheUndLeistung(
  snippets: readonly WebRechercheTreffer[],
  empfaengername: string,
  opts: { timeoutMs?: number } = {},
): Promise<BrancheUndLeistung | null> {
  if (!Array.isArray(snippets) || snippets.length === 0) return null;

  let key: string | null = null;
  let model = "anthropic/claude-haiku-4-5";
  try {
    const aufloesung = await ladeAiKey();
    key = aufloesung.key;
    model = aufloesung.model;
  } catch {
    return null;
  }
  if (!key) return null;

  const llmModel = wahleProviderFuerExtraktion(key, model);

  const snippetBlock = snippets
    .slice(0, 3)
    .map((s, i) => {
      const titel = (s.titel ?? "").trim();
      const beschreibung = (s.beschreibung ?? "").trim();
      return `${i + 1}. ${titel} — ${beschreibung}`;
    })
    .join("\n");

  const system =
    "Du bekommst drei Web-Snippets zu einem Firmennamen. " +
    "Destilliere daraus eine knappe Branche und eine einzeilige Leistung " +
    "auf Deutsch (Sachform). Wenn die Snippets nichts Eindeutiges hergeben, " +
    "gib null zurueck — rate nicht. Antworte ausschliesslich ueber das Schema.";

  const prompt =
    `Firma: ${empfaengername || "(unbekannt)"}\n\n` +
    `Snippets:\n${snippetBlock}\n\n` +
    `Aufgabe: Liefere eine kompakte Branche (1-3 Worte, z. B. ` +
    `"Online-Versandhandel", "Zahlungsdienstleister", "Stromversorgung") ` +
    `und einen einzeiligen Satz zur Leistung (max. 100 Zeichen, z. B. ` +
    `"Stromlieferant in Hannover und Umgebung."). ` +
    `Wenn etwas unklar ist: null.`;

  const timeoutMs = opts.timeoutMs ?? EXTRAKT_TIMEOUT_MS;

  try {
    const result = await Promise.race<{
      object: BrancheUndLeistung;
    } | null>([
      generateObject({
        model: llmModel,
        schema: brancheLeistungSchema,
        system,
        prompt,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!result) return null;
    const { object } = result;
    const branche = object.branche?.trim();
    const leistung = object.leistung?.trim();
    return {
      branche: branche && branche.length > 0 ? branche : null,
      leistung: leistung && leistung.length > 0 ? leistung : null,
    };
  } catch {
    return null;
  }
}
