import type { MappedBeleg } from "./client";

export interface SyncSeitenPlan {
  zu_schreiben: MappedBeleg[];
  neu: number;
  aktualisiert: number;
  unveraendert: number;
}

/** Plant eine Paperless-Seite ohne Datenbankzugriff für einen Batch-Upsert. */
export function planeSyncSeite(
  belege: readonly MappedBeleg[],
  vorhandeneHashes: ReadonlyMap<number, string | null>,
): SyncSeitenPlan {
  const zuSchreiben: MappedBeleg[] = [];
  let neu = 0;
  let aktualisiert = 0;
  let unveraendert = 0;

  for (const beleg of belege) {
    const vorhanden = vorhandeneHashes.has(beleg.paperless_id);
    if (
      vorhanden &&
      vorhandeneHashes.get(beleg.paperless_id) === beleg.inhalt_hash
    ) {
      unveraendert++;
      continue;
    }
    zuSchreiben.push(beleg);
    if (vorhanden) aktualisiert++;
    else neu++;
  }

  return { zu_schreiben: zuSchreiben, neu, aktualisiert, unveraendert };
}
