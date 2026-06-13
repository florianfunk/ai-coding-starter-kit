// PROJ-5 / PROJ-15 — Web-Recherche-Wrapper (nur serverseitig).
//
// Wird gerufen, wenn die LLM-Klassifizierung unsicher ist (Konfidenz <
// Schwellwert) oder der Empfänger unbekannt wirkt. Sucht den Empfängernamen
// im Web, holt 3 kurze Snippets und liefert sie als kompakten Kontext für
// einen zweiten LLM-Aufruf zurück.
//
// Provider-agnostisch (per ENV `SEARCH_PROVIDER` umschaltbar):
//   - "searxng"   → selbst-gehostete SearXNG-Instanz (kostenlos, DSGVO:
//                    Empfängername verlässt die eigene Infrastruktur nicht).
//                    Benötigt `SEARXNG_URL` (z. B. http://host:8888).
//   - "tavily"    → Tavily Search API (Free-Tier), benötigt `TAVILY_API_KEY`.
//   - "firecrawl" → Firecrawl Search (kostenpflichtig), benötigt
//                    `FIRECRAWL_API_KEY`.
// Ohne explizites `SEARCH_PROVIDER` wird automatisch die erste verfügbare
// Quelle in der Reihenfolge searxng → tavily → firecrawl gewählt.
//
// PROJ-15-Erweiterung: `extrahiereBrancheUndLeistung` macht einen
// zusätzlichen kleinen LLM-Call und destilliert aus den drei Snippets
// eine kompakte Branche + Leistung — beides wird mit in den Cache
// geschrieben, damit die LLM-Klassifikation in Folgeläufen besseren
// Kontext sieht.
//
// DSGVO: An die Suchquelle geht NUR der Empfängername (öffentliche Firmen-/
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

type SuchProvider = "searxng" | "tavily" | "firecrawl";

/**
 * Bestimmt die aktive Suchquelle. Explizit über `SEARCH_PROVIDER`, sonst
 * automatisch die erste konfigurierte Quelle (searxng → tavily → firecrawl).
 * Bevorzugt damit standardmäßig die kostenlose, DSGVO-freundliche
 * Self-Hosted-Variante.
 */
function aktiverProvider(): SuchProvider | null {
  const explizit = (process.env.SEARCH_PROVIDER ?? "").trim().toLowerCase();
  if (explizit === "searxng" || explizit === "tavily" || explizit === "firecrawl") {
    return explizit;
  }
  if ((process.env.SEARXNG_URL ?? "").trim()) return "searxng";
  if ((process.env.TAVILY_API_KEY ?? "").trim()) return "tavily";
  if ((process.env.FIRECRAWL_API_KEY ?? "").trim()) return "firecrawl";
  return null;
}

function kuerzeTreffer(
  rohe: Array<{ title?: unknown; description?: unknown; url?: unknown }>,
): WebRechercheTreffer[] {
  return rohe
    .slice(0, 3)
    .map((e) => ({
      titel: typeof e.title === "string" ? e.title.slice(0, 200) : "",
      beschreibung:
        typeof e.description === "string" ? e.description.slice(0, 400) : "",
      url: typeof e.url === "string" ? e.url : "",
    }))
    .filter((t) => t.url !== "");
}

/** SearXNG JSON-API (`/search?...&format=json`). Self-hosted, kostenlos. */
async function sucheSearxng(
  query: string,
  timeoutMs: number,
): Promise<WebRechercheTreffer[] | null> {
  const base = (process.env.SEARXNG_URL ?? "").trim().replace(/\/+$/, "");
  if (!base) return null;
  const url =
    `${base}/search?q=${encodeURIComponent(query)}` +
    `&format=json&language=de&safesearch=0`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{ title?: unknown; content?: unknown; url?: unknown }>;
    };
    const results = Array.isArray(data.results) ? data.results : [];
    // SearXNG nennt den Snippet `content` — auf unser `description` mappen.
    return kuerzeTreffer(
      results.map((r) => ({ title: r.title, description: r.content, url: r.url })),
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Tavily Search API (Free-Tier). Snippet steckt in `content`. */
async function sucheTavily(
  query: string,
  timeoutMs: number,
): Promise<WebRechercheTreffer[] | null> {
  const key = (process.env.TAVILY_API_KEY ?? "").trim();
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ query, max_results: 3, search_depth: "basic" }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{ title?: unknown; content?: unknown; url?: unknown }>;
    };
    const results = Array.isArray(data.results) ? data.results : [];
    return kuerzeTreffer(
      results.map((r) => ({ title: r.title, description: r.content, url: r.url })),
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Firecrawl Search (kostenpflichtig) — bestehender Pfad. */
async function sucheFirecrawl(
  query: string,
  timeoutMs: number,
): Promise<WebRechercheTreffer[] | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  const client = new Firecrawl({ apiKey });
  const timer = setTimeout(() => {}, timeoutMs);
  try {
    const result = await client.search(query, {
      limit: 3,
      sources: [{ type: "web" }],
    });
    const web = (result as { web?: unknown[] }).web;
    if (!Array.isArray(web)) return null;
    return kuerzeTreffer(
      web as Array<{ title?: unknown; description?: unknown; url?: unknown }>,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sucht den Empfängernamen + 'Deutschland' und liefert Top-Treffer über die
 * konfigurierte Suchquelle. Liefert `null` bei jedem Fehler (kein Werfen —
 * Recherche ist optional).
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

  const provider = aktiverProvider();
  if (!provider) return null;

  // Empfängernamen aus MoneyMoney enthalten oft Adresse/Straße — wir
  // schneiden auf die ersten ~80 Zeichen, das LLM-Signal ist im Namen.
  const queryName = name.slice(0, 80).replace(/\s+/g, " ").trim();
  const query = `${queryName} Deutschland Unternehmen Branche`;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const treffer =
      provider === "searxng"
        ? await sucheSearxng(query, timeoutMs)
        : provider === "tavily"
          ? await sucheTavily(query, timeoutMs)
          : await sucheFirecrawl(query, timeoutMs);
    if (!treffer || treffer.length === 0) return null;
    return { query, treffer };
  } catch {
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
