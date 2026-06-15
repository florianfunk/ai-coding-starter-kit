// PROJ-20-Fix (kritisch): PostgREST/Supabase deckelt JEDE Antwort serverseitig
// auf `db-max-rows` (Default 1000) — unabhängig davon, welches `.limit(n)` der
// Client anfordert. Queries mit `.limit(20000)` o. ä. liefern also stillschweigend
// nur die ersten 1000 Zeilen. Bei `order by buchung_datum asc` sind das die
// ÄLTESTEN — neuere Buchungen fallen unsichtbar raus und verfälschen jede
// Aggregation (USt-VA, EÜR, ESt, Analysen).
//
// `ladeAlle` umgeht das, indem es seitenweise über `.range()` lädt, bis eine
// Seite kürzer als die Seitengröße zurückkommt (= letzte Seite).
//
// WICHTIG für den Aufrufer:
//   - In der Builder-Funktion `.range(von, bis)` verwenden, KEIN `.limit()`.
//   - Eine STABILE Gesamt-Sortierung sicherstellen (z. B. zusätzlich nach `id`
//     sortieren), sonst können an Seitengrenzen Zeilen doppelt/fehlend sein.

interface QueryErgebnis<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** PostgREST-Default für `db-max-rows`. Seitengröße = Cap, damit jede volle
 *  Seite "es könnte mehr geben" bedeutet. */
export const MAX_ROWS_SEITE = 1000;

export async function ladeAlle<T>(
  baueSeite: (von: number, bis: number) => PromiseLike<QueryErgebnis<T>>,
  seitenGroesse: number = MAX_ROWS_SEITE,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const alle: T[] = [];
  let von = 0;
  // Sicherheits-Obergrenze gegen Endlosschleifen (max. 1 Mio. Zeilen).
  for (let runde = 0; runde < 1000; runde++) {
    const bis = von + seitenGroesse - 1;
    const { data, error } = await baueSeite(von, bis);
    if (error) return { data: alle, error };
    const seite = data ?? [];
    alle.push(...seite);
    if (seite.length < seitenGroesse) break;
    von += seitenGroesse;
  }
  return { data: alle, error: null };
}
