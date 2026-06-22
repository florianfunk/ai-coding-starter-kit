// SSRF-Schutz für die Paperless-Integration (PROJ-3, Hardening).
//
// Die Paperless-Basis-URL ist nutzerkonfigurierbar. Ohne Schutz könnte ein
// Angreifer (oder eine Fehlkonfiguration) den Server dazu bringen, interne
// Ziele anzusprechen (localhost, private Netze, Cloud-Metadaten-Endpunkte wie
// 169.254.169.254). Dieser Wächter blockiert solche Ziele und erzwingt im
// Produktivbetrieb HTTPS.
//
// Kernlogik (IP-Klassifizierung, URL-Form) ist rein und ohne DNS testbar.
// Die DNS-Auflösung ist injizierbar (`aufloesen`), damit Tests deterministisch
// bleiben.
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Auflösungsfunktion Hostname -> Liste von IP-Adressen (A/AAAA). */
export type AufloesenFn = (hostname: string) => Promise<string[]>;

export interface SsrfOptionen {
  /**
   * Private/lokale Ziele + http erlauben. Default: nur außerhalb der
   * Produktion (lokale Paperless-Entwicklungsinstanz). In Produktion via
   * STEUERAGENT_ALLOW_PRIVATE_PAPERLESS="true" explizit aktivierbar.
   */
  erlaubePrivat?: boolean;
  /** Injizierbare DNS-Auflösung (Tests). Default: node:dns lookup(all). */
  aufloesen?: AufloesenFn;
}

/** Vom URL-Wächter geworfener Fehler (klassifiziert für klare UI-Meldung). */
export class PaperlessSicherheitsError extends Error {
  constructor(
    message: string,
    public readonly kind: "blocked" | "insecure" | "bad_url",
  ) {
    super(message);
    this.name = "PaperlessSicherheitsError";
  }
}

/** True, wenn der Standard (ohne explizite Option) private Ziele erlaubt. */
export function privatStandardErlaubt(): boolean {
  if (process.env.STEUERAGENT_ALLOW_PRIVATE_PAPERLESS === "true") return true;
  return process.env.NODE_ENV !== "production";
}

/**
 * Prüft eine IPv4-Adresse auf private/reservierte Bereiche.
 * Liefert false für Strings, die keine gültige IPv4 sind.
 */
export function istPrivateIPv4(ip: string): boolean {
  const teile = ip.split(".");
  if (teile.length !== 4) return false;
  const okt = teile.map((t) => Number(t));
  if (okt.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = okt;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // 10.0.0.0/8 privat
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local + Metadaten
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 privat
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 privat
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 Benchmark
  if (a === 255) return true; // 255.x Broadcast/reserviert
  return false;
}

/** Normalisiert eine IPv6-Adresse (Kleinschreibung, IPv4-mapped extrahieren). */
function eingebetteteIPv4(ip: string): string | null {
  // z.B. ::ffff:127.0.0.1 oder ::ffff:7f00:1
  const m = /::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ip);
  return m ? m[1] : null;
}

/** True für private/reservierte IPv6 (loopback, link-local, ULA, mapped v4). */
export function istPrivateIPv6(ip: string): boolean {
  const norm = ip.toLowerCase();
  const v4 = eingebetteteIPv4(norm);
  if (v4) return istPrivateIPv4(v4);
  if (norm === "::1" || norm === "::") return true; // loopback / unspecified
  if (norm.startsWith("fe80") || norm.startsWith("fe9") || norm.startsWith("fea") || norm.startsWith("feb")) {
    return true; // fe80::/10 link-local
  }
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // fc00::/7 ULA
  if (norm.startsWith("fec0")) return true; // site-local (deprecated)
  return false;
}

/** True, wenn die IP-Adresse (v4 oder v6) blockiert werden soll. */
export function istBlockierteIp(ip: string): boolean {
  const typ = isIP(ip);
  if (typ === 4) return istPrivateIPv4(ip);
  if (typ === 6) return istPrivateIPv6(ip);
  // Kein gültiges IP-Literal: konservativ blockieren.
  return true;
}

/** True für Hostnamen, die ohne DNS als lokal/intern gelten. */
export function istBlockierterName(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || h === "localhost.localdomain") return true;
  if (h.endsWith(".localhost")) return true;
  if (h.endsWith(".local")) return true; // mDNS / internes Netz
  if (h.endsWith(".internal")) return true; // z.B. GCP *.internal
  return false;
}

const standardAufloesen: AufloesenFn = async (hostname) => {
  const res = await lookup(hostname, { all: true });
  return res.map((r) => r.address);
};

/**
 * Wirft `PaperlessSicherheitsError`, wenn die URL aus Sicherheitsgründen
 * nicht angesprochen werden darf:
 *  - ungültige URL oder unzulässiges Protokoll (nur http/https),
 *  - http im Produktivbetrieb (HTTPS erzwingen),
 *  - Hostname/IP zeigt auf ein internes/privates Ziel (SSRF).
 *
 * Bei erlaubtem privaten Modus (Dev) werden private Ziele + http zugelassen.
 */
export async function pruefePaperlessUrlSicher(
  rawUrl: string,
  opt: SsrfOptionen = {},
): Promise<void> {
  const erlaubePrivat = opt.erlaubePrivat ?? privatStandardErlaubt();
  const aufloesen = opt.aufloesen ?? standardAufloesen;

  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new PaperlessSicherheitsError("Ungültige Paperless-URL.", "bad_url");
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new PaperlessSicherheitsError(
      "Nur http- und https-URLs sind erlaubt.",
      "bad_url",
    );
  }

  if (!erlaubePrivat && u.protocol !== "https:") {
    throw new PaperlessSicherheitsError(
      "Im Produktivbetrieb ist HTTPS für die Paperless-URL erforderlich.",
      "insecure",
    );
  }

  if (erlaubePrivat) return; // Dev/explizit: private Ziele zugelassen.

  // URL.hostname liefert IPv6 in eckigen Klammern ("[::1]") — entfernen,
  // damit isIP/Klassifizierung greifen.
  let host = u.hostname;
  if (host.startsWith("[") && host.endsWith("]")) host = host.slice(1, -1);
  if (istBlockierterName(host)) {
    throw new PaperlessSicherheitsError(
      "Die Paperless-URL zeigt auf ein lokales/internes Ziel und ist blockiert.",
      "blocked",
    );
  }

  const ips = isIP(host) ? [host] : await aufloesen(host);
  if (ips.length === 0) {
    throw new PaperlessSicherheitsError(
      "Die Paperless-URL konnte nicht aufgelöst werden.",
      "blocked",
    );
  }
  for (const ip of ips) {
    if (istBlockierteIp(ip)) {
      throw new PaperlessSicherheitsError(
        "Die Paperless-URL zeigt auf ein internes/privates Ziel und ist aus Sicherheitsgründen blockiert.",
        "blocked",
      );
    }
  }
}
