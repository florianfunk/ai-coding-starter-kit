// PROJ-10: Einkommensteuer-Vorschau & Privatentnahmen-Aufstellung.
//
// GET ?jahr=YYYY&veranlagung=einzel|zusammen&weitere_einkuenfte=…&
//     vorauszahlungen=…
//
//   -> (1) Grobe ESt-Vorschau auf den EÜR-Gewinn des Jahres als Basis
//          (gleiche Aggregationslogik wie PROJ-9 — berechneEuer aus
//          lib/tax/euer importiert, NICHT dupliziert). Ist das WJ
//          abgeschlossen, wird der eingefrorene Gewinn-Snapshot genutzt.
//      (2) Privatentnahmen-Aufstellung: alle Buchungen mit
//          klassifikation='privat' im WJ, Privatanteil aus PROJ-7-Splits
//          (split_anteil) berücksichtigt, summiert + Drill-down.
//
// Deterministisch, keine KI. ESt-Tarif aus `est_tarif`-Stammdaten je Jahr,
// Fallback auf Seed-Konstante + Warnung. Durchgängiger Unverbindlichkeits-
// Hinweis im Response. Auth Pflicht (getApiUser → 401), owner-scoped.
// Validierung mit Zod VOR jedem DB-Zugriff.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { estVorschauSchema } from "@/lib/validation/est";
import {
  berechneEuer,
  wirtschaftsjahrGrenzen,
  rundeCent,
  type EuerErgebnis,
} from "@/lib/tax/euer";
import {
  berechneEst,
  seedTarif,
  type EstTarif,
  type EstTarifZone,
} from "@/lib/tax/est";
import { ladeAlle } from "@/lib/supabase/fetch-all";
import type { Buchung, Kategorie } from "@/lib/types";

export const runtime = "nodejs";

const DISCLAIMER =
  "Unverbindliche Schätzung. Dies ist KEIN Steuerbescheid und ersetzt " +
  "weder eine Steuerberatung noch die amtliche Veranlagung. Es werden " +
  "vereinfachende Annahmen getroffen (keine Sonderausgaben, " +
  "außergewöhnlichen Belastungen, Freibeträge o. Ä.). Verbindliche " +
  "Aussagen trifft ausschließlich das Finanzamt.";

const SELECT_BUCHUNG =
  "id, konto_id, buchung_datum, betrag, verwendungszweck, empfaenger, waehrung, klassifikation, steuerrelevant, kategorie_id, ust_satz, begruendung, konfidenz, quelle, status, pruef_grund, parent_buchung_id, split_anteil";

const SELECT_KATEGORIE =
  "id, bezeichnung, typ, ust_satz, euer_zeile, elster_kennzahl, aktiv, gueltig_ab";

/** Eine Zeile der Privatentnahmen-Aufstellung (Drill-down-tauglich). */
interface PrivatEntnahmeZeile {
  id: string;
  buchung_datum: string;
  /** Bezeichnung des Kontos (aufgelöst). */
  konto: string;
  /** Effektiver Privatbetrag (Betrag × split_anteil, falls Split). */
  betrag: number;
  /** Originalbetrag der (ggf. Gesamt-)Buchung. */
  betrag_brutto: number;
  /** Anteil (0..1), 1 wenn keine Aufteilung. */
  anteil: number;
  empfaenger: string | null;
  verwendungszweck: string | null;
  kategorie: string | null;
}

/** Wirtschaftsjahr-Beginn-Monat aus dem Firmenprofil (Default Kalenderjahr). */
async function ladeWjBeginn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
): Promise<number> {
  const { data } = await supabase
    .from("firmenprofil")
    .select("wirtschaftsjahr_beginn")
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();
  const m = (data as { wirtschaftsjahr_beginn?: number } | null)
    ?.wirtschaftsjahr_beginn;
  return typeof m === "number" && m >= 1 && m <= 12 ? m : 1;
}

/** Lädt owner-scoped Buchungen eines WJ-Zeitraums (datums-gefiltert). */
async function ladeBuchungen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  von: string,
  bis: string,
): Promise<Buchung[]> {
  const { data, error } = await ladeAlle((vonIdx, bisIdx) =>
    supabase
      .from("buchung")
      .select(SELECT_BUCHUNG)
      .eq("owner_id", ownerId)
      .gte("buchung_datum", von)
      .lte("buchung_datum", bis)
      .order("buchung_datum", { ascending: true })
      .order("id", { ascending: true })
      .range(vonIdx, bisIdx),
  );
  if (error) throw new Error("Buchungen konnten nicht geladen werden.");
  return (data ?? []) as Buchung[];
}

/** Validiert/normalisiert die DB-Tarifzeile zu einem `EstTarif`. */
function tarifAusRow(row: {
  jahr: number;
  grundfreibetrag: number;
  zonen: unknown;
  soli_satz: number;
  soli_freigrenze: number;
}): EstTarif | null {
  if (!Array.isArray(row.zonen)) return null;
  const zonen: EstTarifZone[] = [];
  for (const z of row.zonen as unknown[]) {
    if (typeof z !== "object" || z === null) return null;
    const o = z as Record<string, unknown>;
    if (typeof o.ab !== "number") return null;
    if (o.art !== "null" && o.art !== "progression" && o.art !== "linear") {
      return null;
    }
    zonen.push({
      ab: o.ab,
      art: o.art,
      a: typeof o.a === "number" ? o.a : undefined,
      b: typeof o.b === "number" ? o.b : undefined,
      d: typeof o.d === "number" ? o.d : undefined,
      basis: typeof o.basis === "number" ? o.basis : undefined,
      m: typeof o.m === "number" ? o.m : undefined,
      c: typeof o.c === "number" ? o.c : undefined,
    });
  }
  if (zonen.length === 0) return null;
  zonen.sort((x, y) => x.ab - y.ab);
  return {
    jahr: Number(row.jahr),
    grundfreibetrag: Number(row.grundfreibetrag),
    zonen,
    soli_satz: Number(row.soli_satz),
    soli_freigrenze: Number(row.soli_freigrenze),
  };
}

/**
 * Liefert den Gewinn des WJ. Bei abgeschlossenem Jahr aus dem eingefrorenen
 * EÜR-Snapshot (Konsistenz zu PROJ-9), sonst on-the-fly berechnet.
 */
async function ermittleGewinn(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  jahr: number,
  wjBeginn: number,
): Promise<{
  gewinn: number;
  abgeschlossen: boolean;
  buchungen: Buchung[];
  von: string;
  bis: string;
}> {
  const { von, bis } = wirtschaftsjahrGrenzen(jahr, wjBeginn);
  const buchungen = await ladeBuchungen(supabase, ownerId, von, bis);

  const { data: periode } = await supabase
    .from("steuerperiode")
    .select("status, snapshot")
    .eq("owner_id", ownerId)
    .eq("art", "wirtschaftsjahr")
    .eq("jahr", jahr)
    .is("periode", null)
    .limit(1)
    .maybeSingle();

  if (
    periode &&
    (periode as { status: string }).status === "abgeschlossen" &&
    (periode as { snapshot: unknown }).snapshot
  ) {
    const snap = (periode as { snapshot: { ergebnis: EuerErgebnis } })
      .snapshot;
    return {
      gewinn: snap.ergebnis.gewinn,
      abgeschlossen: true,
      buchungen,
      von,
      bis,
    };
  }

  const { data: katData } = await ladeAlle((vonIdx, bisIdx) =>
    supabase
      .from("kategorie")
      .select(SELECT_KATEGORIE)
      .eq("owner_id", ownerId)
      .order("id", { ascending: true })
      .range(vonIdx, bisIdx),
  );
  const kategorien = (katData ?? []) as Kategorie[];
  const ergebnis = berechneEuer(buchungen, kategorien, jahr, wjBeginn);
  return { gewinn: ergebnis.gewinn, abgeschlossen: false, buchungen, von, bis };
}

/**
 * Baut die Privatentnahmen-Aufstellung: alle Buchungen mit
 * klassifikation='privat' im WJ. Bei PROJ-7-Splits zählt nur der
 * Privatanteil (Betrag × split_anteil). Kontonamen werden aufgelöst.
 */
async function ladePrivatentnahmen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  buchungen: Buchung[],
): Promise<{ zeilen: PrivatEntnahmeZeile[]; summe: number }> {
  const privat = buchungen.filter((b) => b.klassifikation === "privat");
  if (privat.length === 0) return { zeilen: [], summe: 0 };

  // Kontonamen owner-scoped auflösen (eine Query statt N+1).
  const kontoIds = [...new Set(privat.map((b) => b.konto_id))];
  const { data: kontoData } = await supabase
    .from("konto")
    .select("id, bezeichnung")
    .eq("owner_id", ownerId)
    .in("id", kontoIds)
    .limit(1000);
  const kontoName = new Map<string, string>();
  for (const k of (kontoData ?? []) as Array<{
    id: string;
    bezeichnung: string;
  }>) {
    kontoName.set(k.id, k.bezeichnung);
  }

  // Kategoriebezeichnungen (rein informativ im Drill-down).
  const katIds = [
    ...new Set(
      privat
        .map((b) => b.kategorie_id)
        .filter((x): x is string => typeof x === "string"),
    ),
  ];
  const katName = new Map<string, string>();
  if (katIds.length > 0) {
    const { data: katData } = await ladeAlle((vonIdx, bisIdx) =>
      supabase
        .from("kategorie")
        .select("id, bezeichnung")
        .eq("owner_id", ownerId)
        .in("id", katIds)
        .order("id", { ascending: true })
        .range(vonIdx, bisIdx),
    );
    for (const k of (katData ?? []) as Array<{
      id: string;
      bezeichnung: string;
    }>) {
      katName.set(k.id, k.bezeichnung);
    }
  }

  let summe = 0;
  const zeilen: PrivatEntnahmeZeile[] = privat.map((b) => {
    // split_anteil nur bei einer echten Aufteilung (0 < anteil <= 1).
    const anteil =
      typeof b.split_anteil === "number" &&
      b.split_anteil > 0 &&
      b.split_anteil <= 1
        ? b.split_anteil
        : 1;
    const effektiv = rundeCent(b.betrag * anteil);
    summe += effektiv;
    return {
      id: b.id,
      buchung_datum: b.buchung_datum.slice(0, 10),
      konto: kontoName.get(b.konto_id) ?? "Unbekanntes Konto",
      betrag: effektiv,
      betrag_brutto: b.betrag,
      anteil,
      empfaenger: b.empfaenger,
      verwendungszweck: b.verwendungszweck,
      kategorie: b.kategorie_id
        ? (katName.get(b.kategorie_id) ?? null)
        : null,
    };
  });

  zeilen.sort((a, x) =>
    a.buchung_datum < x.buchung_datum
      ? -1
      : a.buchung_datum > x.buchung_datum
        ? 1
        : 0,
  );
  return { zeilen, summe: rundeCent(summe) };
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = estVorschauSchema.safeParse({
    jahr: url.searchParams.get("jahr"),
    veranlagung: url.searchParams.get("veranlagung") ?? undefined,
    weitere_einkuenfte:
      url.searchParams.get("weitere_einkuenfte") ?? undefined,
    vorauszahlungen: url.searchParams.get("vorauszahlungen") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const { jahr, veranlagung, weitere_einkuenfte, vorauszahlungen } =
    parsed.data;

  const supabase = await createClient();
  const wjBeginn = await ladeWjBeginn(supabase, user.id);

  let gewinnInfo: Awaited<ReturnType<typeof ermittleGewinn>>;
  try {
    gewinnInfo = await ermittleGewinn(supabase, user.id, jahr, wjBeginn);
  } catch {
    return NextResponse.json(
      { error: "EÜR-Basis konnte nicht ermittelt werden." },
      { status: 500 },
    );
  }

  // ESt-Tarif: bevorzugt DB-Stammdaten, sonst Seed-Fallback + Warnung.
  const { data: tarifRow } = await supabase
    .from("est_tarif")
    .select("jahr, grundfreibetrag, zonen, soli_satz, soli_freigrenze")
    .eq("owner_id", user.id)
    .eq("jahr", jahr)
    .limit(1)
    .maybeSingle();

  let tarif: EstTarif | null = tarifRow
    ? tarifAusRow(
        tarifRow as {
          jahr: number;
          grundfreibetrag: number;
          zonen: unknown;
          soli_satz: number;
          soli_freigrenze: number;
        },
      )
    : null;
  let tarifAusDb = tarif !== null;
  if (!tarif) {
    tarif = seedTarif(jahr).tarif;
    tarifAusDb = false;
  }

  const ergebnis = berechneEst(
    tarif,
    {
      jahr,
      euer_gewinn: gewinnInfo.gewinn,
      weitere_einkuenfte,
      vorauszahlungen,
      veranlagung,
      jahrFallbackInfo: String(jahr),
    },
    tarifAusDb,
  );

  const privat = await ladePrivatentnahmen(
    supabase,
    user.id,
    gewinnInfo.buchungen,
  );

  if (!gewinnInfo.abgeschlossen) {
    ergebnis.hinweise.push(
      "Die EÜR dieses Wirtschaftsjahres ist noch nicht abgeschlossen. " +
        "Die Schätzung erfolgt auf vorläufiger Basis und kann sich durch " +
        "weitere/geänderte Buchungen noch verändern.",
    );
  }

  return NextResponse.json({
    jahr,
    veranlagung,
    abgeschlossen: gewinnInfo.abgeschlossen,
    zeitraum: { von: gewinnInfo.von, bis: gewinnInfo.bis },
    euer_gewinn: gewinnInfo.gewinn,
    schaetzung: ergebnis,
    privatentnahmen: {
      anzahl: privat.zeilen.length,
      summe: privat.summe,
      zeilen: privat.zeilen,
    },
    disclaimer: DISCLAIMER,
  });
}
