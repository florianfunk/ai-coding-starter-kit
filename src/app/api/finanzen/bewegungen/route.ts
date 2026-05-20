// PROJ-14 — Chronologische Geldbewegungen mit Filter & Pagination.
// Liefert Buchungen + angereicherte Anzeige-Felder (Konto-Bezeichnung,
// Kategorie-Bezeichnung/Typ) ohne dass der Client n+1 nachladen muss.
//
// Filter: Zeitraum, Konto, Bereich, Empfänger-Suche, Kategorie, Richtung
// (Einnahme/Ausgabe per Vorzeichen). Pagination via seite/pro_seite.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { bewegungenFilterSchema } from "@/lib/validation/finanzen";
import { istImBereich } from "@/lib/finanzen/bereich-filter";
import type {
  BuchungStatus,
  KategorieTyp,
  Klassifikation,
} from "@/lib/types";

interface BuchungRow {
  id: string;
  konto_id: string;
  buchung_datum: string;
  betrag: number;
  verwendungszweck: string | null;
  empfaenger: string | null;
  waehrung: string;
  klassifikation: Klassifikation | null;
  steuerrelevant: boolean | null;
  kategorie_id: string | null;
  ust_satz: number | null;
  begruendung: string | null;
  konfidenz: number | null;
  quelle: "regel" | "ki" | "manuell" | null;
  status: BuchungStatus;
  pruef_grund: string | null;
}

export interface BewegungZeile {
  id: string;
  konto_id: string;
  konto_bezeichnung: string;
  buchung_datum: string;
  betrag: number;
  waehrung: string;
  empfaenger: string | null;
  verwendungszweck: string | null;
  klassifikation: Klassifikation | null;
  kategorie_id: string | null;
  kategorie_bezeichnung: string | null;
  kategorie_typ: KategorieTyp | null;
  ust_satz: number | null;
  begruendung: string | null;
  konfidenz: number | null;
  quelle: "regel" | "ki" | "manuell" | null;
  status: BuchungStatus;
  pruef_grund: string | null;
  steuerrelevant: boolean | null;
  /** Wie viele Paperless-Belege sind dieser Buchung zugeordnet? */
  beleg_anzahl: number;
}

export interface BewegungenResponse {
  zeilen: BewegungZeile[];
  /** Gesamt-Anzahl Treffer (vor Pagination). */
  gesamt: number;
  /** Summen über ALLE Treffer (vor Pagination), nicht nur die Seite. */
  summen: {
    einnahmen: number;
    ausgaben: number;
    saldo: number;
  };
  seite: number;
  pro_seite: number;
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = bewegungenFilterSchema.safeParse({
    von: url.searchParams.get("von") ?? undefined,
    bis: url.searchParams.get("bis") ?? undefined,
    konto_id: url.searchParams.get("konto_id") ?? undefined,
    bereich: url.searchParams.get("bereich") ?? undefined,
    suche: url.searchParams.get("suche") ?? undefined,
    kategorie_id: url.searchParams.get("kategorie_id") ?? undefined,
    richtung: url.searchParams.get("richtung") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    richtung_sort: url.searchParams.get("richtung_sort") ?? undefined,
    seite: url.searchParams.get("seite") ?? undefined,
    pro_seite: url.searchParams.get("pro_seite") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültiger Filter" },
      { status: 422 },
    );
  }
  const f = parsed.data;
  const supabase = await createClient();

  // Buchungen laden — Server-Filter, soweit möglich. Bereichs-Filter und
  // Suche werden zusätzlich in JS nachgezogen (Suche, weil wir auf zwei
  // Spalten OR-suchen wollen und das auch über die Empfänger-Normierung
  // greifen soll).
  let q = supabase
    .from("buchung")
    .select(
      "id, konto_id, buchung_datum, betrag, verwendungszweck, empfaenger, waehrung, klassifikation, steuerrelevant, kategorie_id, ust_satz, begruendung, konfidenz, quelle, status, pruef_grund",
    )
    .eq("owner_id", user.id)
    .limit(20000);
  if (f.von) q = q.gte("buchung_datum", f.von);
  if (f.bis) q = q.lte("buchung_datum", f.bis);
  if (f.konto_id) q = q.eq("konto_id", f.konto_id);
  if (f.kategorie_id === "ohne") q = q.is("kategorie_id", null);
  else if (f.kategorie_id) q = q.eq("kategorie_id", f.kategorie_id);
  if (f.richtung === "einnahme") q = q.gt("betrag", 0);
  if (f.richtung === "ausgabe") q = q.lt("betrag", 0);

  const { data: bData, error: bErr } = await q;
  if (bErr) {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  // Stammdaten für Anreicherung
  const [kontenResult, kategorienResult] = await Promise.all([
    supabase
      .from("konto")
      .select("id, bezeichnung")
      .eq("owner_id", user.id),
    supabase
      .from("kategorie")
      .select("id, bezeichnung, typ")
      .eq("owner_id", user.id),
  ]);
  const kontoMap = new Map<string, string>(
    ((kontenResult.data ?? []) as Array<{ id: string; bezeichnung: string }>).map(
      (k) => [k.id, k.bezeichnung],
    ),
  );
  const katMap = new Map<
    string,
    { bezeichnung: string; typ: KategorieTyp }
  >(
    (
      (kategorienResult.data ?? []) as Array<{
        id: string;
        bezeichnung: string;
        typ: KategorieTyp;
      }>
    ).map((k) => [k.id, { bezeichnung: k.bezeichnung, typ: k.typ }]),
  );

  let buchungen = (bData ?? []) as BuchungRow[];

  // Bereichs-Filter (JS — kanonisch)
  if (f.bereich !== "alle") {
    buchungen = buchungen.filter((b) =>
      istImBereich(
        {
          klassifikation: b.klassifikation,
          kategorieTyp: b.kategorie_id ? (katMap.get(b.kategorie_id)?.typ ?? null) : null,
        },
        f.bereich,
      ),
    );
  }

  // Empfänger-/Zweck-Suche
  if (f.suche) {
    const s = f.suche.toLowerCase();
    buchungen = buchungen.filter(
      (b) =>
        (b.empfaenger?.toLowerCase().includes(s) ?? false) ||
        (b.verwendungszweck?.toLowerCase().includes(s) ?? false),
    );
  }

  // Sortierung
  const sortFaktor = f.richtung_sort === "asc" ? 1 : -1;
  buchungen.sort((a, b) => {
    if (f.sort === "betrag") {
      return (Number(a.betrag) - Number(b.betrag)) * sortFaktor;
    }
    // datum, mit ID als Tiebreaker für stabile Sortierung
    const dc = a.buchung_datum.localeCompare(b.buchung_datum) * sortFaktor;
    return dc !== 0 ? dc : a.id.localeCompare(b.id) * sortFaktor;
  });

  // Summen vor Pagination
  let einnahmen = 0;
  let ausgaben = 0;
  for (const b of buchungen) {
    const betrag = Number(b.betrag) || 0;
    if (betrag > 0) einnahmen += betrag;
    else if (betrag < 0) ausgaben += Math.abs(betrag);
  }

  const gesamt = buchungen.length;
  const start = (f.seite - 1) * f.pro_seite;
  const seite = buchungen.slice(start, start + f.pro_seite);

  // Beleg-Anzahl je Buchung — nur für die aktuelle Seite (n+1 vermeiden,
  // aber pro Seite eine einzige Abfrage).
  const seitenIds = seite.map((b) => b.id);
  const belegAnzahl = new Map<string, number>();
  if (seitenIds.length > 0) {
    const { data: bbData } = await supabase
      .from("beleg_buchung")
      .select("buchung_id")
      .eq("owner_id", user.id)
      .in("buchung_id", seitenIds);
    for (const r of (bbData ?? []) as Array<{ buchung_id: string }>) {
      belegAnzahl.set(r.buchung_id, (belegAnzahl.get(r.buchung_id) ?? 0) + 1);
    }
  }

  const zeilen: BewegungZeile[] = seite.map((b) => {
    const kat = b.kategorie_id ? katMap.get(b.kategorie_id) : null;
    return {
      id: b.id,
      konto_id: b.konto_id,
      konto_bezeichnung: kontoMap.get(b.konto_id) ?? "—",
      buchung_datum: b.buchung_datum,
      betrag: Number(b.betrag) || 0,
      waehrung: b.waehrung,
      empfaenger: b.empfaenger,
      verwendungszweck: b.verwendungszweck,
      klassifikation: b.klassifikation,
      kategorie_id: b.kategorie_id,
      kategorie_bezeichnung: kat?.bezeichnung ?? null,
      kategorie_typ: kat?.typ ?? null,
      ust_satz: b.ust_satz === null ? null : Number(b.ust_satz),
      begruendung: b.begruendung,
      konfidenz: b.konfidenz === null ? null : Number(b.konfidenz),
      quelle: b.quelle,
      status: b.status,
      pruef_grund: b.pruef_grund,
      steuerrelevant: b.steuerrelevant,
      beleg_anzahl: belegAnzahl.get(b.id) ?? 0,
    };
  });

  const payload: BewegungenResponse = {
    zeilen,
    gesamt,
    summen: {
      einnahmen: Math.round(einnahmen * 100) / 100,
      ausgaben: Math.round(ausgaben * 100) / 100,
      saldo: Math.round((einnahmen - ausgaben) * 100) / 100,
    },
    seite: f.seite,
    pro_seite: f.pro_seite,
  };
  return NextResponse.json(payload);
}
