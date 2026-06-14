// PROJ-20: Client-Helper für den Merkliste-Toggle. Reiner fetch-Wrapper,
// kein React-State — die optimistische Logik liegt in den Container-Ansichten.

/**
 * Setzt oder entfernt den Merken-Status einer Buchung.
 * @returns true bei Erfolg, false bei Fehler (Container rollt dann zurück).
 */
export async function toggleMerken(
  buchungId: string,
  gewollt: boolean,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/buchungen/${buchungId}/merkliste`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: gewollt ? "add" : "remove" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
