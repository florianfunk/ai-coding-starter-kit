// PROJ-12: Serverseitiger Lade-/Aggregations-Helfer fürs Dashboard.
//
// Lädt owner-scoped genau die Daten, die das Dashboard braucht — effizient
// (count-only Queries via head:true wo nur Zählung gebraucht wird, .limit()
// auf allen Listen) — und reicht sie an die REINEN Helfer aus ./aggregate.
//
// Wird sowohl von der API-Route (/api/dashboard) als auch direkt von der
// Server-Komponente (/dashboard) verwendet, damit es eine Datenquelle gibt.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ladeAlle } from "@/lib/supabase/fetch-all";
import { ladeAktivesJahr } from "@/lib/jahr/aktives-jahr";
import {
  bereitePerioden,
  berechneJahresKennzahlen,
  laufendesWirtschaftsjahr,
  syncStatusAus,
  type DashboardAggregat,
  type DashboardBuchung,
} from "./aggregate";
import { berechneMonatsReihen } from "./trend";
import { berechneYoy, minusEinJahr } from "./yoy";
import { naechsteUstFrist } from "./fristen";
import { berechneHealthScore } from "./health-score";
import { ladeAktivitaet } from "./aktivitaet";
import type { UstRhythmus } from "@/lib/tax/perioden";

/** Heutiges Datum als ISO yyyy-MM-dd (UTC, stabil & testbar separat). */
function heuteIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function letzterJob(
  supabase: SupabaseClient,
  ownerId: string,
  art: "paperless_sync" | "konto_import",
): Promise<{
  status: "laeuft" | "fertig" | "fehler";
  created_at: string;
  fehler_text: string | null;
} | null> {
  const { data } = await supabase
    .from("job_lauf")
    .select("status, created_at, fehler_text")
    .eq("owner_id", ownerId)
    .eq("art", art)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (
    (data as {
      status: "laeuft" | "fertig" | "fehler";
      created_at: string;
      fehler_text: string | null;
    } | null) ?? null
  );
}

async function exaktZaehlen(
  supabase: SupabaseClient,
  ownerId: string,
  tabelle: "buchung" | "beleg" | "konto",
): Promise<number> {
  const { count } = await supabase
    .from(tabelle)
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  return count ?? 0;
}

/**
 * Lädt & aggregiert alle Dashboard-Kennzahlen für `ownerId`.
 *
 * Performance: Die Jahres-Kennzahlen brauchen die Buchungen des laufenden
 * Wirtschaftsjahres; diese werden zeitlich gefiltert und mit Obergrenze
 * geladen. Alles Übrige sind count-only Queries (head:true) bzw. Top-1.
 */
export async function ladeDashboardAggregat(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<DashboardAggregat> {
  const stand = new Date().toISOString();
  const heute = heuteIso();

  // Wirtschaftsjahr-Beginn aus dem Firmenprofil (Default Kalenderjahr).
  // firmenname dient zugleich als Onboarding-Signal "Profil angelegt".
  const { data: profil } = await supabase
    .from("firmenprofil")
    .select(
      "wirtschaftsjahr_beginn, firmenname, ust_va_rhythmus, dauerfristverlaengerung",
    )
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();
  const profilRow = profil as {
    wirtschaftsjahr_beginn?: number;
    firmenname?: string | null;
    ust_va_rhythmus?: UstRhythmus | null;
    dauerfristverlaengerung?: boolean | null;
  } | null;
  const wjBeginn = profilRow?.wirtschaftsjahr_beginn ?? 1;
  const profilAngelegt = !!profilRow?.firmenname?.trim();
  const ustRhythmus: UstRhythmus = profilRow?.ust_va_rhythmus ?? "monatlich";
  const dauerfrist = profilRow?.dauerfristverlaengerung ?? false;

  // PROJ-22: Globales aktives Jahr berücksichtigen. Die Jahres-Kennzahlen
  // (Einnahmen/Ausgaben/USt-Schätzung) sollen das gewählte Jahr abbilden, nicht
  // hart das laufende Wirtschaftsjahr. Dazu setzen wir das Referenzdatum auf das
  // aktive Jahr (Beginn des Wirtschaftsjahres in diesem Jahr); `berechneJahres-
  // Kennzahlen` leitet daraus dasselbe Fenster ab wie der Lade-Query. Bei
  // "Alle Jahre" (null) bleibt es beim laufenden Wirtschaftsjahr (heute).
  // Cross-Period-Status (Aktions-Kennzahlen, Perioden, Onboarding) bleibt
  // bewusst über alle Jahre — diese zeigen den Gesamt-Handlungsbedarf.
  const aktivesJahr = await ladeAktivesJahr(supabase, ownerId);
  const refDatum =
    aktivesJahr == null
      ? heute
      : `${aktivesJahr}-${String(
          wjBeginn >= 1 && wjBeginn <= 12 ? wjBeginn : 1,
        ).padStart(2, "0")}-01`;

  const { von, bis } = laufendesWirtschaftsjahr(refDatum, wjBeginn);

  // Aktions-Kennzahlen + Onboarding-Signale: count-only / top-1 Queries.
  const [
    prueffaelleC,
    unklassifiziertC,
    belegeC,
    kontenC,
    gesamtBuchungenC,
    kategorienC,
    klassifiziertC,
    paperlessRow,
  ] = await Promise.all([
    supabase
      .from("buchung")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("status", "zur_pruefung"),
    supabase
      .from("buchung")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("status", "offen"),
    exaktZaehlen(supabase, ownerId, "beleg"),
    exaktZaehlen(supabase, ownerId, "konto"),
    exaktZaehlen(supabase, ownerId, "buchung"),
    supabase
      .from("kategorie")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId),
    supabase
      .from("buchung")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .neq("status", "offen"),
    supabase
      .from("paperless_verbindung")
      .select("token_cipher")
      .eq("owner_id", ownerId)
      .limit(1)
      .maybeSingle(),
  ]);

  // Fehlende Belege: geschäftliche Buchungen ohne beleg_buchung-Zuordnung.
  // Wir laden nur IDs der geschäftlichen Buchungen (schlank) + die belegten
  // IDs und bilden die Differenz.
  // Vollständig paginiert laden — PostgREST deckelt sonst bei 1000 Zeilen
  // (siehe ladeAlle); stabile Sortierung via id.
  const { data: geschIds } = await ladeAlle<{ id: string }>((von, bis) =>
    supabase
      .from("buchung")
      .select("id")
      .eq("owner_id", ownerId)
      .eq("klassifikation", "geschaeftlich")
      .order("id", { ascending: true })
      .range(von, bis),
  );
  const geschaeftlicheIds = (geschIds as Array<{ id: string }>).map(
    (r) => r.id,
  );
  let fehlendeBelege = 0;
  if (geschaeftlicheIds.length > 0) {
    const { data: bbData } = await ladeAlle<{ buchung_id: string }>(
      (von, bis) =>
        supabase
          .from("beleg_buchung")
          .select("buchung_id")
          .eq("owner_id", ownerId)
          .order("buchung_id", { ascending: true })
          .range(von, bis),
    );
    const belegt = new Set(
      ((bbData ?? []) as Array<{ buchung_id: string }>).map(
        (r) => r.buchung_id,
      ),
    );
    fehlendeBelege = geschaeftlicheIds.filter((id) => !belegt.has(id)).length;
  }

  const aktionen = {
    offene_prueffaelle: prueffaelleC.count ?? 0,
    fehlende_belege: fehlendeBelege,
    unklassifiziert: unklassifiziertC.count ?? 0,
  };

  // Jahres-Kennzahlen: nur Buchungen des laufenden WJ, schlanke Spalten.
  // Vollständig paginiert laden — sonst deckelt PostgREST bei 1000 Zeilen und
  // die Jahres-Summen wären zu niedrig (siehe ladeAlle). Stabile Sortierung
  // via buchung_datum + id.
  type Roh = {
    id: string;
    betrag: number;
    buchung_datum: string;
    klassifikation: DashboardBuchung["klassifikation"];
    status: DashboardBuchung["status"];
    ust_satz: number | null;
  };
  const { data: wjBuchungen } = await ladeAlle<Roh>((rangeVon, rangeBis) =>
    supabase
      .from("buchung")
      .select("id, betrag, buchung_datum, klassifikation, status, ust_satz")
      .eq("owner_id", ownerId)
      .gte("buchung_datum", von)
      .lte("buchung_datum", bis)
      .order("buchung_datum", { ascending: true })
      .order("id", { ascending: true })
      .range(rangeVon, rangeBis),
  );
  const rohWj = wjBuchungen as Roh[];

  // Hinweis: Das belegt-Flag wird von berechneJahresKennzahlen nicht mehr
  // benötigt (Vorsteuer-Schätzung läuft seit Phase 1 ohne Belegabgleich, wie
  // im USt-VA-Modul). Daher kein zusätzlicher beleg_buchung-Load hier.
  const dashboardBuchungen: DashboardBuchung[] = rohWj.map((b) => ({
    betrag: typeof b.betrag === "number" ? b.betrag : Number(b.betrag),
    buchung_datum: b.buchung_datum,
    klassifikation: b.klassifikation,
    status: b.status,
    ust_satz:
      b.ust_satz === null
        ? null
        : typeof b.ust_satz === "number"
          ? b.ust_satz
          : Number(b.ust_satz),
    belegt: false,
  }));

  // PROJ-22: refDatum (aktives Jahr) statt heute — so deckt sich das
  // intern abgeleitete Fenster mit dem geladenen `von`/`bis`.
  const jahr = berechneJahresKennzahlen(dashboardBuchungen, refDatum, wjBeginn);

  // PROJ-30 (AC3): Monatsreihen aus DERSELBEN Datenmenge/Inputs wie das
  // Jahres-Aggregat (kein zusätzlicher DB-Query). Für die Trend-Sparklines.
  const trend = berechneMonatsReihen(dashboardBuchungen, refDatum, wjBeginn);

  // PROJ-31 (AC3): Vorjahresvergleich. Das Vorjahres-WJ-Fenster liegt genau
  // ein Jahr vor [von, bis]. Es ist NICHT in `dashboardBuchungen` enthalten
  // (die decken nur das Bezugs-WJ ab), daher EIN zusätzlicher zeitgefilterter,
  // vollständig paginierter Query auf das Vorjahres-Fenster (mit Obergrenze
  // via ladeAlle — kein unbeschränkter Scan). YTD-Kürzung passiert rein in
  // berechneYoy; wir laden das volle Vorjahres-WJ und lassen die Funktion auf
  // den analogen Tag schneiden.
  // Schalttag-sicher: minusEinJahr klemmt 29.02. ohne Vorjahres-Schalttag auf
  // 28.02. (ein naiver String-Slice erzeugte sonst ein ungültiges Datum wie
  // 2023-02-29 → kaputter DB-Query bei WJ-Beginn März).
  const vjVon = minusEinJahr(von);
  const vjBis = minusEinJahr(bis);
  const { data: vjBuchungen } = await ladeAlle<Roh>((rangeVon, rangeBis) =>
    supabase
      .from("buchung")
      .select("id, betrag, buchung_datum, klassifikation, status, ust_satz")
      .eq("owner_id", ownerId)
      .eq("klassifikation", "geschaeftlich")
      .gte("buchung_datum", vjVon)
      .lte("buchung_datum", vjBis)
      .order("buchung_datum", { ascending: true })
      .order("id", { ascending: true })
      .range(rangeVon, rangeBis),
  );
  const vjDashboardBuchungen: DashboardBuchung[] = (vjBuchungen as Roh[]).map(
    (b) => ({
      betrag: typeof b.betrag === "number" ? b.betrag : Number(b.betrag),
      buchung_datum: b.buchung_datum,
      klassifikation: b.klassifikation,
      status: b.status,
      ust_satz:
        b.ust_satz === null
          ? null
          : typeof b.ust_satz === "number"
            ? b.ust_satz
            : Number(b.ust_satz),
      belegt: false,
    }),
  );
  // Kein Crash bei leerem Account: berechneYoy verträgt leere Buchungen; wir
  // setzen `vorjahr` aber nur, wenn überhaupt Buchungen existieren (sonst null
  // → UI blendet die YoY-Zeile aus, AC5).
  const vorjahr =
    gesamtBuchungenC > 0
      ? berechneYoy(
          vjDashboardBuchungen,
          {
            einnahmen: jahr.einnahmen,
            ausgaben: jahr.ausgaben,
            ust_zahllast: jahr.voraussichtliche_ust_zahllast,
            gewinn: jahr.vorlaeufiger_gewinn,
          },
          refDatum,
          heute,
          wjBeginn,
        )
      : null;

  // Steuerperioden (alle, klein begrenzt — eine Firma hat überschaubar viele).
  const { data: periodenData } = await supabase
    .from("steuerperiode")
    .select("art, jahr, periode, status")
    .eq("owner_id", ownerId)
    .order("jahr", { ascending: false })
    .limit(200);
  const perioden = bereitePerioden(
    (periodenData ?? []) as Array<{
      art: "ust_va" | "wirtschaftsjahr";
      jahr: number;
      periode: number | null;
      status: "offen" | "geprueft" | "abgeschlossen";
    }>,
  );

  const [paperlessJob, importJob] = await Promise.all([
    letzterJob(supabase, ownerId, "paperless_sync"),
    letzterJob(supabase, ownerId, "konto_import"),
  ]);

  // Hinweis: Die Aktions-Kennzahlen werden hier aus count-only Queries
  // gebildet (Performance). Die reine `zaehleAktionen` aus ./aggregate
  // liefert dasselbe Ergebnis aus Rohdaten und ist dort separat getestet.

  const paperlessToken = (
    paperlessRow.data as { token_cipher?: string | null } | null
  )?.token_cipher;

  const onboarding = {
    profil: profilAngelegt,
    kontenrahmen: (kategorienC.count ?? 0) > 0,
    paperless: !!paperlessToken && paperlessToken.length > 0,
    konten: kontenC > 0,
    import: gesamtBuchungenC > 0,
    klassifizierung: (klassifiziertC.count ?? 0) > 0,
  };

  // PROJ-27 (AC1): nächste USt-VA-Frist. Abgeschlossene USt-VA-Perioden aus
  // den bereits geladenen Perioden ableiten (art='ust_va', status='abgeschlossen').
  // "heute" wird als Parameter reingereicht (testbar in fristen.ts selbst).
  const abgeschlossenePerioden = perioden
    .filter((p) => p.art === "ust_va" && p.status === "abgeschlossen")
    .map((p) => ({ jahr: p.jahr, periode: p.periode ?? 0 }));
  const fristen = naechsteUstFrist({
    rhythmus: ustRhythmus,
    heute,
    abgeschlossene_perioden: abgeschlossenePerioden,
    dauerfristverlaengerung: dauerfrist,
  });

  // PROJ-27 (AC2): Health-Score aus den vorhandenen Counts + Fristen-Ampel.
  const health_score = berechneHealthScore({
    gesamt_buchungen: gesamtBuchungenC,
    unklassifiziert: aktionen.unklassifiziert,
    offene_prueffaelle: aktionen.offene_prueffaelle,
    geschaeftlich_gesamt: geschaeftlicheIds.length,
    fehlende_belege: aktionen.fehlende_belege,
    sync_fehler:
      syncStatusAus(paperlessJob).ist_fehler ||
      syncStatusAus(importJob).ist_fehler,
    fristen_ampel: fristen?.ampel ?? null,
  });

  // PROJ-27 (AC3): Aktivitäts-Feed (owner-scoped, zusätzlich zur RLS).
  const aktivitaet = await ladeAktivitaet(supabase, ownerId);

  return {
    aktionen,
    jahr,
    trend,
    vorjahr,
    perioden,
    paperless_sync: syncStatusAus(paperlessJob),
    konto_import: syncStatusAus(importJob),
    fristen,
    health_score,
    aktivitaet,
    ist_leer:
      gesamtBuchungenC === 0 && belegeC === 0 && kontenC === 0,
    onboarding,
    stand,
  };
}
