/**
 * PROJ-33: Helper für den /api/bild-Proxy.
 *
 * Baut eine stabile URL im Format /api/bild/<bucket>/<path> (URL-encoded Segments).
 * Nur stabile URLs erlauben dem Next.js Image Optimizer das Cachen.
 *
 * Rückgabe:
 *  - null, wenn path leer/null ist (Call-Sites rendern dann einen Platzhalter).
 *  - ansonsten einen absoluten Path, der von <Image src> konsumiert werden kann.
 *
 * Der Pfad wird in einzelne Segmente zerlegt und jedes Segment einzeln encoded,
 * damit Slashes im Storage-Pfad korrekt abgebildet werden und Sonderzeichen
 * (Leerzeichen, Umlaute) nicht die Route brechen.
 */
export function bildProxyUrl(bucket: string, path: string | null | undefined): string | null {
  if (!path) return null;
  const segments = path.split("/").filter(Boolean).map(encodeURIComponent);
  if (segments.length === 0) return null;
  return `/api/bild/${encodeURIComponent(bucket)}/${segments.join("/")}`;
}
