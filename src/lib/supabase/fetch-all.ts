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

// Zweites, ORTHOGONALES Problem: ein PostgREST-Filter wie `.in("spalte", werte)`
// packt ALLE Werte in die GET-URL. Bei großen Werte-Arrays (z. B. alle
// Buchungs-IDs oder Duplikat-Hashes eines Jahres / eines langen Amex-Auszugs)
// sprengt das die maximale URL-Länge → der Request scheitert mit HTTP 400.
//
// `ladeNachBloecken` zerlegt die WERTELISTE in Blöcke, führt die Query je Block
// aus und hängt die Ergebnisse aneinander. (Komplementär zu `ladeAlle`, das die
// ANTWORT paginiert — hier geht es um die EINGABE.)
//
// Blockgröße konservativ: UUIDs (~36 Zeichen) + Trenner ≈ 39 Zeichen; 100 Werte
// ≈ 3,9 kB Query-String — deutlich unter der Grenze, ab der PostgREST 400 wirft.

/** Default-Blockgröße für `ladeNachBloecken` (URL-längen-sicher). */
export const IN_BLOCK_GROESSE = 100;

export async function ladeNachBloecken<T, V>(
  werte: readonly V[],
  baueBlock: (block: V[]) => PromiseLike<QueryErgebnis<T>>,
  blockGroesse: number = IN_BLOCK_GROESSE,
): Promise<{ data: T[]; error: { message: string } | null }> {
  const alle: T[] = [];
  for (let i = 0; i < werte.length; i += blockGroesse) {
    const block = werte.slice(i, i + blockGroesse);
    if (block.length === 0) continue;
    const { data, error } = await baueBlock(block);
    if (error) return { data: alle, error };
    if (data) alle.push(...data);
  }
  return { data: alle, error: null };
}
