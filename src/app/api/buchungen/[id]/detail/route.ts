// PROJ-14: Detail-Sicht einer einzelnen Buchung — Volldaten, verlinkte
// Paperless-Belege, Audit-Historie, Konto- und Kategorie-Anreicherung.
// Reine Lese-API für das Detail-Sheet.
//
// Auth Pflicht (getApiUser), owner-scoped. RLS deckt die Joins
// zusätzlich ab; wir filtern überall explizit auf owner_id für klare
// Fehlermeldungen.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import type {
  BuchungStatus,
  KategorieTyp,
  Klassifikation,
} from "@/lib/types";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BelegLink {
  beleg_id: string;
  paperless_id: number;
  titel: string | null;
  beleg_datum: string | null;
  korrespondent: string | null;
  betrag: number | null;
  status: "importiert" | "unvollstaendig" | "quelle_entfernt";
  quell_link: string | null;
  match_score: number | null;
  match_status: "auto" | "manuell" | "unsicher";
  gesperrt: boolean;
}

export interface AuditEintrag {
  id: string;
  aktion: string;
  quelle: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface BuchungDetail {
  id: string;
  konto_id: string;
  konto_bezeichnung: string;
  buchung_datum: string;
  betrag: number;
  waehrung: string;
  verwendungszweck: string | null;
  empfaenger: string | null;
  duplikat_hash: string;
  import_quelle: string | null;
  klassifikation: Klassifikation | null;
  steuerrelevant: boolean | null;
  kategorie_id: string | null;
  kategorie_bezeichnung: string | null;
  kategorie_typ: KategorieTyp | null;
  ust_satz: number | null;
  begruendung: string | null;
  konfidenz: number | null;
  quelle: "regel" | "ki" | "manuell" | null;
  regel_id: string | null;
  regel_bezeichnung: string | null;
  status: BuchungStatus;
  pruef_grund: string | null;
  parent_buchung_id: string | null;
  split_anteil: number | null;
  gemerkt_am: string | null;
  created_at: string;
  updated_at: string;
  belege: BelegLink[];
  audit: AuditEintrag[];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
  }

  const supabase = await createClient();

  // 1) Buchung selbst
  const { data: bData, error: bErr } = await supabase
    .from("buchung")
    .select(
      "id, konto_id, buchung_datum, betrag, waehrung, verwendungszweck, empfaenger, duplikat_hash, import_quelle, klassifikation, steuerrelevant, kategorie_id, ust_satz, begruendung, konfidenz, quelle, regel_id, status, pruef_grund, parent_buchung_id, split_anteil, gemerkt_am, created_at, updated_at",
    )
    .eq("owner_id", user.id)
    .eq("id", id)
    .limit(1)
    .maybeSingle();
  if (bErr) {
    return NextResponse.json({ error: "Ladefehler." }, { status: 500 });
  }
  if (!bData) {
    return NextResponse.json(
      { error: "Buchung nicht gefunden." },
      { status: 404 },
    );
  }
  const b = bData as {
    id: string;
    konto_id: string;
    buchung_datum: string;
    betrag: number;
    waehrung: string;
    verwendungszweck: string | null;
    empfaenger: string | null;
    duplikat_hash: string;
    import_quelle: string | null;
    klassifikation: Klassifikation | null;
    steuerrelevant: boolean | null;
    kategorie_id: string | null;
    ust_satz: number | null;
    begruendung: string | null;
    konfidenz: number | null;
    quelle: "regel" | "ki" | "manuell" | null;
    regel_id: string | null;
    status: BuchungStatus;
    pruef_grund: string | null;
    parent_buchung_id: string | null;
    split_anteil: number | null;
    gemerkt_am: string | null;
    created_at: string;
    updated_at: string;
  };

  // 2) Konto + Kategorie + Regel in einer Welle
  const [
    { data: kontoData },
    { data: katData },
    { data: regelData },
    { data: bbData },
    { data: auditData },
  ] = await Promise.all([
    supabase
      .from("konto")
      .select("id, bezeichnung")
      .eq("owner_id", user.id)
      .eq("id", b.konto_id)
      .limit(1)
      .maybeSingle(),
    b.kategorie_id
      ? supabase
          .from("kategorie")
          .select("id, bezeichnung, typ")
          .eq("owner_id", user.id)
          .eq("id", b.kategorie_id)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    b.regel_id
      ? supabase
          .from("lernregel")
          .select("id, bezeichnung")
          .eq("owner_id", user.id)
          .eq("id", b.regel_id)
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("beleg_buchung")
      .select(
        "beleg_id, match_score, status, gesperrt, beleg:beleg ( id, paperless_id, titel, beleg_datum, korrespondent, betrag, status, quell_link )",
      )
      .eq("owner_id", user.id)
      .eq("buchung_id", id),
    supabase
      .from("audit_eintrag")
      .select("id, aktion, quelle, details, created_at")
      .eq("owner_id", user.id)
      .eq("entitaet", "buchung")
      .eq("entitaet_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Supabase liefert eingebettete Relationen je nach FK-Modellierung als
  // Array — wir nehmen das erste/einzige Element.
  interface BbRow {
    beleg_id: string;
    match_score: number | null;
    status: "auto" | "manuell" | "unsicher";
    gesperrt: boolean;
    beleg:
      | {
          paperless_id: number;
          titel: string | null;
          beleg_datum: string | null;
          korrespondent: string | null;
          betrag: number | null;
          status: "importiert" | "unvollstaendig" | "quelle_entfernt";
          quell_link: string | null;
        }
      | Array<{
          paperless_id: number;
          titel: string | null;
          beleg_datum: string | null;
          korrespondent: string | null;
          betrag: number | null;
          status: "importiert" | "unvollstaendig" | "quelle_entfernt";
          quell_link: string | null;
        }>
      | null;
  }
  const belege: BelegLink[] = ((bbData ?? []) as unknown as BbRow[])
    .map((r) => {
      const bel = Array.isArray(r.beleg) ? (r.beleg[0] ?? null) : r.beleg;
      if (!bel) return null;
      return {
        beleg_id: r.beleg_id,
        paperless_id: bel.paperless_id,
        titel: bel.titel,
        beleg_datum: bel.beleg_datum,
        korrespondent: bel.korrespondent,
        betrag: bel.betrag === null ? null : Number(bel.betrag),
        status: bel.status,
        quell_link: bel.quell_link,
        match_score: r.match_score === null ? null : Number(r.match_score),
        match_status: r.status,
        gesperrt: r.gesperrt,
      } satisfies BelegLink;
    })
    .filter((x): x is BelegLink => x !== null);

  const audit: AuditEintrag[] = ((auditData ?? []) as Array<{
    id: string;
    aktion: string;
    quelle: string | null;
    details: Record<string, unknown> | null;
    created_at: string;
  }>).map((a) => ({
    id: a.id,
    aktion: a.aktion,
    quelle: a.quelle,
    details: a.details,
    created_at: a.created_at,
  }));

  const detail: BuchungDetail = {
    id: b.id,
    konto_id: b.konto_id,
    konto_bezeichnung:
      (kontoData as { bezeichnung?: string } | null)?.bezeichnung ?? "—",
    buchung_datum: b.buchung_datum,
    betrag: Number(b.betrag) || 0,
    waehrung: b.waehrung,
    verwendungszweck: b.verwendungszweck,
    empfaenger: b.empfaenger,
    duplikat_hash: b.duplikat_hash,
    import_quelle: b.import_quelle,
    klassifikation: b.klassifikation,
    steuerrelevant: b.steuerrelevant,
    kategorie_id: b.kategorie_id,
    kategorie_bezeichnung:
      (katData as { bezeichnung?: string } | null)?.bezeichnung ?? null,
    kategorie_typ:
      (katData as { typ?: KategorieTyp } | null)?.typ ?? null,
    ust_satz: b.ust_satz === null ? null : Number(b.ust_satz),
    begruendung: b.begruendung,
    konfidenz: b.konfidenz === null ? null : Number(b.konfidenz),
    quelle: b.quelle,
    regel_id: b.regel_id,
    regel_bezeichnung:
      (regelData as { bezeichnung?: string } | null)?.bezeichnung ?? null,
    status: b.status,
    pruef_grund: b.pruef_grund,
    parent_buchung_id: b.parent_buchung_id,
    split_anteil: b.split_anteil === null ? null : Number(b.split_anteil),
    gemerkt_am: b.gemerkt_am,
    created_at: b.created_at,
    updated_at: b.updated_at,
    belege,
    audit,
  };
  return NextResponse.json(detail);
}
