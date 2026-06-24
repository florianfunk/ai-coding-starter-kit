// PROJ-33 — Worker-Pool mit festem Concurrency-Limit (kein npm-Dep).
//
// `mapMitLimit` verarbeitet eine Liste von Items mit einer asynchronen
// Worker-Funktion, wobei NIE mehr als `limit` Worker gleichzeitig laufen.
// Die Ergebnisse werden in der EINGABE-Reihenfolge zurueckgegeben (jedes
// Resultat ist seinem Index zugeordnet — unabhaengig davon, in welcher
// Reihenfolge die Worker fertig werden).
//
// Wird vom Klassifizierungs-Job genutzt, um die pro-Buchung-Verarbeitung
// (LLM-Call + DB-Update) mit begrenzter Nebenlaeufigkeit auszufuehren, statt
// streng seriell. Bewusst eigener, getesteter Helfer statt p-limit:
//  - kein neues Dependency,
//  - exakt das benoetigte Verhalten (Limit, Index-Zuordnung, frueher Stopp).
//
// Fehlerverhalten: Wirft die Worker-Funktion fuer ein Item, wird dieser
// Fehler NICHT verschluckt — er reicht zum Aufrufer durch und beendet den
// Lauf. Im Klassifizierungs-Job faengt der Worker pro Buchung selbst alles
// ab (try/catch je Buchung), sodass mapMitLimit dort faktisch nie wirft.

/**
 * Pro-Item-Worker. Bekommt das Item und seinen Index (stabil zur Eingabe).
 */
export type MapWorker<TItem, TResult> = (
  item: TItem,
  index: number,
) => Promise<TResult>;

/**
 * Optionaler Abbruch-Hook: wird VOR dem Start jedes Items aufgerufen. Liefert
 * er `true`, wird KEIN weiteres Item mehr gestartet (bereits laufende Worker
 * werden zu Ende gefuehrt). Damit laesst sich z. B. ein Zeitbudget einhalten.
 */
export type SollAbbrechen = () => boolean;

export interface MapMitLimitOptions {
  /** Vor jedem Item-Start geprueft. true → keine neuen Tasks mehr starten. */
  sollAbbrechen?: SollAbbrechen;
}

export interface MapMitLimitErgebnis<TResult> {
  /**
   * Ergebnisse je Index der gestarteten Items (Eingabe-Reihenfolge). Nur die
   * tatsaechlich GESTARTETEN Items haben einen Eintrag; bei fr*hem Abbruch
   * sind die hinteren Indizes nicht enthalten.
   */
  ergebnisse: TResult[];
  /**
   * Anzahl tatsaechlich gestarteter (= verarbeiteter) Items. Bei Abbruch <
   * items.length.
   */
  gestartet: number;
  /**
   * True, wenn `sollAbbrechen` gegriffen hat und nicht alle Items gestartet
   * wurden.
   */
  abgebrochen: boolean;
}

/**
 * Verarbeitet `items` mit maximal `limit` gleichzeitig laufenden Workern.
 *
 * Garantien:
 *  - Zu keinem Zeitpunkt laufen mehr als `limit` Worker gleichzeitig.
 *  - `ergebnisse[i]` gehoert exakt zu `items[i]` (Index-stabil), unabhaengig
 *    von der Fertigstellungs-Reihenfolge.
 *  - Alle Items werden verarbeitet — ausser `sollAbbrechen` greift, dann
 *    werden keine NEUEN Items mehr gestartet, laufende aber sauber beendet.
 *  - Ein in einem Worker geworfener Fehler propagiert zum Aufrufer (kein
 *    stilles Verschlucken). Andere bereits laufende Worker werden noch
 *    abgewartet, bevor geworfen wird.
 *
 * @param items   Zu verarbeitende Elemente.
 * @param limit   Maximale Nebenlaeufigkeit (>= 1; Werte < 1 werden zu 1).
 * @param worker  Asynchrone Verarbeitung je Item.
 * @param options Optionaler Abbruch-Hook (Zeitbudget).
 */
export async function mapMitLimit<TItem, TResult>(
  items: readonly TItem[],
  limit: number,
  worker: MapWorker<TItem, TResult>,
  options: MapMitLimitOptions = {},
): Promise<MapMitLimitErgebnis<TResult>> {
  const n = items.length;
  const ergebnisse = new Array<TResult>(n);
  const sollAbbrechen = options.sollAbbrechen;

  // Effektives Limit: mindestens 1, hoechstens Anzahl Items.
  const echtesLimit = Math.max(1, Math.min(Math.floor(limit) || 1, n || 1));

  let naechsterIndex = 0;
  let gestartet = 0;
  let abgebrochen = false;
  // Erster aufgetretener Worker-Fehler — erst nach Drain geworfen, damit
  // laufende Worker nicht verwaist zurueckbleiben.
  let ersterFehler: unknown = undefined;
  let fehlerAufgetreten = false;

  // Ein einzelner Pool-Runner: zieht Items, bis nichts mehr zu holen ist
  // (Liste leer / Abbruch / Fehler).
  async function runner(): Promise<void> {
    for (;;) {
      // Bei bereits aufgetretenem Fehler keine neuen Items mehr ziehen.
      if (fehlerAufgetreten) return;
      // Abbruch-Hook VOR dem naechsten Start pruefen (Zeitbudget).
      if (sollAbbrechen && sollAbbrechen()) {
        abgebrochen = true;
        return;
      }
      const i = naechsterIndex;
      if (i >= n) return;
      naechsterIndex += 1;
      gestartet += 1;

      try {
        ergebnisse[i] = await worker(items[i], i);
      } catch (err) {
        if (!fehlerAufgetreten) {
          fehlerAufgetreten = true;
          ersterFehler = err;
        }
        return;
      }
    }
  }

  const runnerCount = Math.min(echtesLimit, n);
  const runners: Promise<void>[] = [];
  for (let r = 0; r < runnerCount; r++) {
    runners.push(runner());
  }
  await Promise.all(runners);

  if (fehlerAufgetreten) {
    throw ersterFehler;
  }

  // Ergebnis-Array auf die tatsaechlich gestarteten Indizes zuschneiden.
  // Bei Abbruch koennen hintere Slots leer (undefined) sein — wir geben nur
  // den befuellten Praefix zurueck, dessen Laenge == hoechster gestarteter
  // Index + 1 ist. Da Runner Items strikt aufsteigend ziehen, sind die ersten
  // `gestartet` Indizes befuellt.
  return {
    ergebnisse: ergebnisse.slice(0, gestartet),
    gestartet,
    abgebrochen,
  };
}
