// Serverseitiger Paperless-ngx-REST-Adapter (PROJ-3).
// NUR serverseitig verwenden — Token wird als Bearer übergeben, NIE geloggt,
// NIE an den Client. Pagination + Rate-Limit-/Fehler-tolerant.
import { createHash } from "node:crypto";

/** Rohes Paperless-Dokument (relevante Felder der REST-API). */
export interface PaperlessRawDocument {
  id: number;
  title: string | null;
  created: string | null;
  created_date: string | null;
  added: string | null;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
  content: string | null;
  archive_serial_number?: number | null;
  custom_fields?: Array<{ field: number; value: unknown }> | null;
}

/** Aufgelöste Namens-Maps für IDs (Korrespondent, Dokumenttyp, Tags). */
export interface PaperlessLookups {
  correspondents: Map<number, string>;
  documentTypes: Map<number, string>;
  tags: Map<number, string>;
}

/** Auf STEUERAGENT-Beleg gemapptes Dokument (Klartext, owner-frei). */
export interface MappedBeleg {
  paperless_id: number;
  titel: string | null;
  beleg_datum: string | null;
  korrespondent: string | null;
  betrag: number | null;
  tags: string[];
  dokumenttyp: string | null;
  ocr_text: string | null;
  quell_link: string | null;
  inhalt_hash: string;
  status: "importiert" | "unvollstaendig";
}

export interface PaperlessFilter {
  von?: string;
  bis?: string;
  tag?: string;
  korrespondent?: string;
}

export class PaperlessError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | "auth"
      | "unreachable"
      | "rate_limit"
      | "bad_response"
      | "unknown",
  ) {
    super(message);
    this.name = "PaperlessError";
  }
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  results: T[];
}

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 500; // Sicherheitsbremse (max. 50.000 Dokumente/Lauf)
const FETCH_TIMEOUT_MS = 30_000;
const RATE_LIMIT_RETRIES = 3;

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Token ${token}`,
    Accept: "application/json",
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch mit Timeout + Rate-Limit-Backoff (HTTP 429).
 * Wirft PaperlessError mit klassifiziertem `kind` für klare UI-Meldungen.
 */
async function paperlessFetch(
  url: string,
  token: string,
): Promise<Response> {
  let lastErr: unknown;
  for (let versuch = 0; versuch <= RATE_LIMIT_RETRIES; versuch++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: authHeaders(token),
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timer);

      if (res.status === 401 || res.status === 403) {
        throw new PaperlessError(
          "Token ungültig oder abgelaufen. Bitte API-Token erneuern.",
          "auth",
        );
      }
      if (res.status === 429) {
        if (versuch < RATE_LIMIT_RETRIES) {
          const retryAfter = Number(res.headers.get("retry-after")) || 0;
          await delay(retryAfter > 0 ? retryAfter * 1000 : 2 ** versuch * 1000);
          continue;
        }
        throw new PaperlessError(
          "Paperless meldet zu viele Anfragen (Rate-Limit). Bitte später erneut versuchen.",
          "rate_limit",
        );
      }
      if (!res.ok) {
        throw new PaperlessError(
          `Paperless antwortete mit HTTP ${res.status}.`,
          "bad_response",
        );
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof PaperlessError) throw err;
      lastErr = err;
      // Netzwerk-/Abbruchfehler: kurzer Retry, dann aufgeben.
      if (versuch < RATE_LIMIT_RETRIES) {
        await delay(2 ** versuch * 500);
        continue;
      }
    }
  }
  throw new PaperlessError(
    `Paperless-Instanz nicht erreichbar (${
      lastErr instanceof Error ? lastErr.message : "unbekannter Fehler"
    }).`,
    "unreachable",
  );
}

/**
 * Verbindungstest: ruft den /api/-Wurzelendpunkt mit Token auf.
 * Liefert {ok:true} oder einen klassifizierten Fehler.
 */
export async function testConnection(
  baseUrl: string,
  token: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const root = `${normalizeBaseUrl(baseUrl)}/api/documents/?page_size=1`;
  try {
    await paperlessFetch(root, token);
    return { ok: true };
  } catch (err) {
    if (err instanceof PaperlessError) {
      return { ok: false, message: err.message };
    }
    return { ok: false, message: "Unbekannter Fehler beim Verbindungstest." };
  }
}

/** Entfernt trailing slashes für stabile URL-Bildung. */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

async function fetchLookup(
  baseUrl: string,
  token: string,
  resource: "correspondents" | "document_types" | "tags",
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  let next: string | null =
    `${normalizeBaseUrl(baseUrl)}/api/${resource}/?page_size=${DEFAULT_PAGE_SIZE}`;
  let pages = 0;
  while (next && pages < MAX_PAGES) {
    const res = await paperlessFetch(next, token);
    const json = (await res.json()) as PaginatedResponse<{
      id: number;
      name: string;
    }>;
    for (const item of json.results) {
      if (typeof item.id === "number") map.set(item.id, item.name ?? "");
    }
    next = json.next;
    pages++;
  }
  return map;
}

/** Lädt Korrespondenten-, Dokumenttyp- und Tag-Namensauflösung. */
export async function fetchLookups(
  baseUrl: string,
  token: string,
): Promise<PaperlessLookups> {
  const [correspondents, documentTypes, tags] = await Promise.all([
    fetchLookup(baseUrl, token, "correspondents"),
    fetchLookup(baseUrl, token, "document_types"),
    fetchLookup(baseUrl, token, "tags"),
  ]);
  return { correspondents, documentTypes, tags };
}

/** Baut die paginierte Dokumenten-URL inkl. optionalem Filter. */
export function buildDocumentsUrl(
  baseUrl: string,
  filter: PaperlessFilter,
  page: number,
): string {
  const u = new URL(`${normalizeBaseUrl(baseUrl)}/api/documents/`);
  u.searchParams.set("page", String(page));
  u.searchParams.set("page_size", String(DEFAULT_PAGE_SIZE));
  u.searchParams.set("ordering", "id");
  if (filter.von) u.searchParams.set("created__date__gte", filter.von);
  if (filter.bis) u.searchParams.set("created__date__lte", filter.bis);
  if (filter.tag) u.searchParams.set("tags__name__icontains", filter.tag);
  if (filter.korrespondent) {
    u.searchParams.set(
      "correspondent__name__icontains",
      filter.korrespondent,
    );
  }
  return u.toString();
}

/**
 * Async-Generator: liefert seitenweise rohe Dokumente.
 * Fortsetzbar/abbrechbar durch Aufrufer (for-await).
 */
export async function* iterateDocuments(
  baseUrl: string,
  token: string,
  filter: PaperlessFilter,
): AsyncGenerator<PaperlessRawDocument[]> {
  let page = 1;
  let pages = 0;
  while (pages < MAX_PAGES) {
    const url = buildDocumentsUrl(baseUrl, filter, page);
    const res = await paperlessFetch(url, token);
    const json = (await res.json()) as PaginatedResponse<PaperlessRawDocument>;
    if (!Array.isArray(json.results)) {
      throw new PaperlessError(
        "Unerwartetes Antwortformat von Paperless.",
        "bad_response",
      );
    }
    yield json.results;
    if (!json.next) break;
    page++;
    pages++;
  }
}

const AMOUNT_REGEX =
  /(?:summe|gesamt|betrag|total|brutto|rechnungsbetrag)[^0-9-]{0,20}(-?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|-?\d+(?:,\d{2})|-?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+(?:\.\d{2}))/i;

/**
 * Versucht, einen Geldbetrag aus OCR-Text zu erkennen.
 * Bevorzugt Beträge nahe Schlüsselwörtern (Summe/Gesamt/Betrag).
 * Liefert null, wenn nichts Belastbares gefunden wird.
 */
export function parseBetragAusText(text: string | null): number | null {
  if (!text) return null;
  const m = AMOUNT_REGEX.exec(text);
  if (!m || !m[1]) return null;
  return normalizeAmountString(m[1]);
}

/** Wandelt "1.234,56" / "1,234.56" / "1234,56" in eine Zahl. */
export function normalizeAmountString(raw: string): number | null {
  let s = raw.replace(/\s/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Letztes Trennzeichen ist Dezimaltrenner.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Stabiler Inhalts-Hash für Duplikaterkennung + Änderungserkennung. */
export function inhaltHash(input: {
  paperless_id: number;
  titel: string | null;
  beleg_datum: string | null;
  korrespondent: string | null;
  betrag: number | null;
  ocr_text: string | null;
}): string {
  const basis = [
    input.paperless_id,
    input.titel ?? "",
    input.beleg_datum ?? "",
    input.korrespondent ?? "",
    input.betrag ?? "",
    (input.ocr_text ?? "").slice(0, 5000),
  ].join("");
  return createHash("sha256").update(basis, "utf8").digest("hex");
}

/** Normalisiert ein Paperless-Datum (ISO oder Date) auf JJJJ-MM-TT. */
export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * Mappt ein rohes Paperless-Dokument auf einen STEUERAGENT-Beleg.
 * Status "unvollstaendig", wenn Belegdatum ODER Betrag fehlt.
 */
export function mapDocumentToBeleg(
  doc: PaperlessRawDocument,
  lookups: PaperlessLookups,
  baseUrl: string,
): MappedBeleg {
  const beleg_datum =
    toIsoDate(doc.created_date) ?? toIsoDate(doc.created) ?? null;
  const korrespondent =
    doc.correspondent != null
      ? lookups.correspondents.get(doc.correspondent) ?? null
      : null;
  const dokumenttyp =
    doc.document_type != null
      ? lookups.documentTypes.get(doc.document_type) ?? null
      : null;
  const tags = (doc.tags ?? [])
    .map((id) => lookups.tags.get(id))
    .filter((v): v is string => typeof v === "string" && v.length > 0);

  const betrag =
    betragAusCustomFields(doc.custom_fields) ??
    parseBetragAusText(doc.content);

  const titel = doc.title?.trim() || null;
  const ocr_text = doc.content ?? null;
  const quell_link = `${normalizeBaseUrl(baseUrl)}/documents/${doc.id}/`;

  const unvollstaendig = beleg_datum === null || betrag === null;

  return {
    paperless_id: doc.id,
    titel,
    beleg_datum,
    korrespondent,
    betrag,
    tags,
    dokumenttyp,
    ocr_text,
    quell_link,
    inhalt_hash: inhaltHash({
      paperless_id: doc.id,
      titel,
      beleg_datum,
      korrespondent,
      betrag,
      ocr_text,
    }),
    status: unvollstaendig ? "unvollstaendig" : "importiert",
  };
}

/** Sucht in Paperless-Custom-Fields nach einem numerischen Betrag. */
export function betragAusCustomFields(
  fields: PaperlessRawDocument["custom_fields"],
): number | null {
  if (!Array.isArray(fields)) return null;
  for (const f of fields) {
    const v = f?.value;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = normalizeAmountString(v);
      if (n !== null) return n;
    }
  }
  return null;
}
