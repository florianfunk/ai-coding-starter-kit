// PROJ-24: Klassifizierungs-Statistik — reine Aggregation (kein IO).
// Aus minimal geladenen Buchungs-Zeilen (status, quelle, buchung_datum) je
// Jahr + gesamt die Zähler bauen, die das Klassifizierung-Center anzeigt.

/** Minimal benötigte Buchungs-Felder für die Statistik. */
export interface StatZeile {
  status: string | null;
  quelle: string | null;
  buchung_datum: string | null;
}

export interface JahrStat {
  /** Kalenderjahr; 0 = „gesamt"-Aggregat. */
  jahr: number;
  total: number;
  offen: number;
  auto_verbucht: number;
  zur_pruefung: number;
  manuell_bestaetigt: number;
  /** verarbeitet = total - offen (vorberechnet für die UI). */
  verarbeitet: number;
  via_regel: number;
  via_vorjahr: number;
  via_ki: number;
  via_manuell: number;
}

export interface KlassifizierungStatistik {
  /** Pro Jahr, absteigend (neuestes zuerst). */
  jahre: JahrStat[];
  /** Über alle Jahre. */
  gesamt: JahrStat;
}

function leererStat(jahr: number): JahrStat {
  return {
    jahr,
    total: 0,
    offen: 0,
    auto_verbucht: 0,
    zur_pruefung: 0,
    manuell_bestaetigt: 0,
    verarbeitet: 0,
    via_regel: 0,
    via_vorjahr: 0,
    via_ki: 0,
    via_manuell: 0,
  };
}

function zaehle(stat: JahrStat, z: StatZeile): void {
  stat.total++;
  switch (z.status) {
    case "offen":
      stat.offen++;
      break;
    case "auto_verbucht":
      stat.auto_verbucht++;
      break;
    case "zur_pruefung":
      stat.zur_pruefung++;
      break;
    case "manuell_bestaetigt":
      stat.manuell_bestaetigt++;
      break;
  }
  switch (z.quelle) {
    case "regel":
      stat.via_regel++;
      break;
    case "vorjahr":
      stat.via_vorjahr++;
      break;
    case "ki":
      stat.via_ki++;
      break;
    case "manuell":
      stat.via_manuell++;
      break;
  }
}

/** Jahr aus ISO-Datum (YYYY-..) oder null. */
function jahrVon(datum: string | null): number | null {
  if (!datum || datum.length < 4) return null;
  const j = Number(datum.slice(0, 4));
  return Number.isFinite(j) ? j : null;
}

export function baueKlassifizierungStatistik(
  zeilen: readonly StatZeile[],
): KlassifizierungStatistik {
  const proJahr = new Map<number, JahrStat>();
  const gesamt = leererStat(0);

  for (const z of zeilen) {
    zaehle(gesamt, z);
    const jahr = jahrVon(z.buchung_datum);
    if (jahr == null) continue;
    let s = proJahr.get(jahr);
    if (!s) {
      s = leererStat(jahr);
      proJahr.set(jahr, s);
    }
    zaehle(s, z);
  }

  gesamt.verarbeitet = gesamt.total - gesamt.offen;
  const jahre = [...proJahr.values()].sort((a, b) => b.jahr - a.jahr);
  for (const s of jahre) s.verarbeitet = s.total - s.offen;

  return { jahre, gesamt };
}
