// Zentraler CSRF-Schutz für mutierende API-Routen (Hardening).
//
// Cookie-basierte Auth (Supabase) ist anfällig für Cross-Site-Request-Forgery:
// ein fremder Origin könnte im Browser des eingeloggten Nutzers eine
// state-ändernde Anfrage auslösen. Wir prüfen daher bei POST/PUT/PATCH/DELETE
// den Origin-Header gegen den Host und – falls vorhanden – Sec-Fetch-Site.
//
// Die Funktion ist rein (nur Header-Auswertung) und damit gut testbar; sie wird
// von der Next.js-Middleware für alle /api-Routen aufgerufen.

const MUTIERENDE_METHODEN = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface CsrfErgebnis {
  ok: boolean;
  /** Grund bei Ablehnung (für serverseitiges Logging). */
  grund?: string;
}

/**
 * Prüft eine Anfrage auf einen plausiblen Same-Origin-Kontext.
 *
 * Regeln:
 *  - Sichere Methoden (GET/HEAD/OPTIONS) sind immer erlaubt.
 *  - Ist ein Origin-Header gesetzt, muss sein Host dem Request-Host entsprechen.
 *  - Ohne Origin: Sec-Fetch-Site entscheidet ("same-origin"/"none" erlaubt,
 *    "cross-site"/"same-site" blockiert).
 *  - Fehlen beide Header (z. B. Server-zu-Server, curl), wird zugelassen —
 *    dort ist die Authentifizierung die primäre Verteidigungslinie. CSRF zielt
 *    auf Browser-Kontexte, die immer mindestens einen der Header senden.
 */
export function pruefeCsrf(request: Request): CsrfErgebnis {
  const methode = request.method.toUpperCase();
  if (!MUTIERENDE_METHODEN.has(methode)) return { ok: true };

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (origin && origin !== "null") {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return { ok: false, grund: "Ungültiger Origin-Header." };
    }
    if (host && originHost === host) return { ok: true };
    return {
      ok: false,
      grund: `Origin (${originHost}) stimmt nicht mit Host (${host ?? "?"}) überein.`,
    };
  }

  const site = request.headers.get("sec-fetch-site");
  if (site) {
    if (site === "same-origin" || site === "none") return { ok: true };
    return { ok: false, grund: `Cross-Site-Anfrage blockiert (Sec-Fetch-Site: ${site}).` };
  }

  // Weder Origin noch Sec-Fetch-Site: kein Browser-CSRF-Vektor.
  return { ok: true };
}
