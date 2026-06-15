// PROJ-11: Export-Endpunkt (PDF / CSV / ELSTER).
//
// POST { typ, format, jahr, periode? }  -> erzeugt die gewählte Datei und
//   liefert sie als Download (Content-Disposition, Dateiname
//   Firma_Typ_Zeitraum). GET mit gleichen Query-Parametern wird für
//   direkte Download-Links unterstützt.
//
// Stabilität: Bei abgeschlossenen Perioden/Jahren wird der unveränderliche
// steuerperiode.snapshot verwendet (deterministisch). Sonst on-the-fly
// berechnet + deutlicher „vorläufig"-Vermerk im PDF.
//
// Datenschutz: betriebliche Exporte (EÜR/USt-VA/ELSTER/Buchungen) enthalten
// KEINE privaten Posten. Privatentnahmen nur im dedizierten Export.
//
// Auth Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS. Zod VOR
// jedem DB-Zugriff. Reine tax-Funktionen direkt aufgerufen (nicht die
// HTTP-Routen) — keine KI in den Summen.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  exportRequestSchema,
  type ExportRequest,
} from "@/lib/validation/export";
import {
  berechneEuer,
  wirtschaftsjahrGrenzen,
  type EuerErgebnis,
} from "@/lib/tax/euer";
import {
  berechneUstVa,
  type UstBerechnung,
  type UstBuchung,
} from "@/lib/tax/ust";
import {
  ustVaPeriode,
  periodeFuerDatum,
  type UstRhythmus,
} from "@/lib/tax/perioden";
import {
  euerPdf,
  ustvaPdf,
  privatentnahmenPdf,
  elsterPdf,
  type FirmenKopf,
  type PrivatentnahmeZeile,
} from "@/lib/export/pdf";
import {
  buchungenAlsCsv,
  elsterKennzahlenAlsCsv,
  type BuchungsExportZeile,
  type ElsterKennzahlZeile,
} from "@/lib/export/csv";
import type { Buchung, Kategorie } from "@/lib/types";
import { ladeAlle } from "@/lib/supabase/fetch-all";

export const runtime = "nodejs";

interface ProfilRow {
  firmenname: string;
  inhaber: string;
  steuernummer: string | null;
  ust_idnr: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  finanzamt: string | null;
  ust_status: "regelbesteuerung" | "kleinunternehmer";
  ust_va_rhythmus: "monatlich" | "quartalsweise" | "jaehrlich";
  wirtschaftsjahr_beginn: number;
}

const SELECT_PROFIL =
  "firmenname, inhaber, steuernummer, ust_idnr, strasse, plz, ort, finanzamt, ust_status, ust_va_rhythmus, wirtschaftsjahr_beginn";

const SELECT_BUCHUNG =
  "id, konto_id, buchung_datum, betrag, verwendungszweck, empfaenger, waehrung, klassifikation, steuerrelevant, kategorie_id, ust_satz, begruendung, konfidenz, quelle, status, pruef_grund, parent_buchung_id, split_anteil, gemerkt_am";

const SELECT_KATEGORIE =
  "id, bezeichnung, typ, ust_satz, euer_zeile, elster_kennzahl, aktiv, gueltig_ab";

function rhythmusVon(p: ProfilRow): UstRhythmus {
  return p.ust_va_rhythmus === "quartalsweise"
    ? "quartalsweise"
    : p.ust_va_rhythmus === "jaehrlich"
      ? "jaehrlich"
      : "monatlich";
}

function firmenKopf(p: ProfilRow): FirmenKopf {
  return {
    firmenname: p.firmenname,
    inhaber: p.inhaber,
    steuernummer: p.steuernummer,
    ust_idnr: p.ust_idnr,
    strasse: p.strasse,
    plz: p.plz,
    ort: p.ort,
    finanzamt: p.finanzamt,
  };
}

/** Dateiname: Firma_Typ_Zeitraum.ext — slug-sicher, reproduzierbar. */
function dateiname(
  firma: string,
  typ: string,
  zeitraum: string,
  ext: string,
): string {
  const slug = (s: string) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "Export";
  return `${slug(firma)}_${slug(typ)}_${slug(zeitraum)}.${ext}`;
}

function fehler(msg: string, status: number): NextResponse {
  return NextResponse.json({ error: msg }, { status });
}

async function ladeProfil(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
): Promise<ProfilRow | null> {
  const { data } = await supabase
    .from("firmenprofil")
    .select(SELECT_PROFIL)
    .eq("owner_id", ownerId)
    .limit(1)
    .maybeSingle();
  return (data as ProfilRow | null) ?? null;
}

async function ladeBuchungenJahr(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  von: string,
  bis: string,
): Promise<Buchung[]> {
  const { data, error } = await ladeAlle((von2, bisIdx) =>
    supabase
      .from("buchung")
      .select(SELECT_BUCHUNG)
      .eq("owner_id", ownerId)
      .gte("buchung_datum", von)
      .lte("buchung_datum", bis)
      .order("buchung_datum", { ascending: true })
      .order("id", { ascending: true })
      .range(von2, bisIdx),
  );
  if (error) throw new Error("Buchungen konnten nicht geladen werden.");
  return (data ?? []) as Buchung[];
}

async function ladeKategorien(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
): Promise<Kategorie[]> {
  const { data, error } = await ladeAlle<Kategorie>((von, bisIdx) =>
    supabase
      .from("kategorie")
      .select(SELECT_KATEGORIE)
      .eq("owner_id", ownerId)
      .order("id", { ascending: true })
      .range(von, bisIdx),
  );
  if (error) throw new Error("Kategorien konnten nicht geladen werden.");
  return (data ?? []) as Kategorie[];
}

async function ladeBelegteIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
): Promise<Set<string>> {
  const { data } = await ladeAlle<{ buchung_id: string }>((von, bisIdx) =>
    supabase
      .from("beleg_buchung")
      .select("buchung_id")
      .eq("owner_id", ownerId)
      .order("buchung_id", { ascending: true })
      .order("id", { ascending: true })
      .range(von, bisIdx),
  );
  const s = new Set<string>();
  for (const r of (data ?? []) as Array<{ buchung_id: string }>) {
    s.add(r.buchung_id);
  }
  return s;
}

/** Liefert eine Datei-Response mit Download-Headern. */
function datei(
  body: Buffer | string,
  name: string,
  contentType: string,
): NextResponse {
  const payload: Buffer = Buffer.isBuffer(body)
    ? body
    : Buffer.from(body, "utf-8");
  return new NextResponse(payload as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Content-Length": String(payload.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

// --- EÜR / Privatentnahmen / Buchungen brauchen das Wirtschaftsjahr ---------

async function erzeugeEuer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  profil: ProfilRow,
  req: ExportRequest,
): Promise<NextResponse> {
  const wjBeginn = profil.wirtschaftsjahr_beginn;
  const { von, bis } = wirtschaftsjahrGrenzen(req.jahr, wjBeginn);

  // Abgeschlossenes Jahr → unveränderlicher Snapshot.
  const { data: periode } = await supabase
    .from("steuerperiode")
    .select("status, snapshot")
    .eq("owner_id", ownerId)
    .eq("art", "wirtschaftsjahr")
    .eq("jahr", req.jahr)
    .is("periode", null)
    .limit(1)
    .maybeSingle();

  let ergebnis: EuerErgebnis;
  let vorlaeufig = true;
  const abgeschlossen =
    periode &&
    (periode as { status: string }).status === "abgeschlossen" &&
    (periode as { snapshot: unknown }).snapshot;
  if (abgeschlossen) {
    const snap = (periode as { snapshot: { ergebnis: EuerErgebnis } })
      .snapshot;
    ergebnis = snap.ergebnis;
    vorlaeufig = false;
  } else {
    let buchungen: Buchung[];
    let kategorien: Kategorie[];
    try {
      buchungen = await ladeBuchungenJahr(supabase, ownerId, von, bis);
      kategorien = await ladeKategorien(supabase, ownerId);
    } catch {
      return fehler("Daten konnten nicht geladen werden.", 500);
    }
    ergebnis = berechneEuer(buchungen, kategorien, req.jahr, wjBeginn);
  }

  const pdf = await euerPdf(firmenKopf(profil), ergebnis, vorlaeufig);
  return datei(
    pdf,
    dateiname(
      profil.firmenname,
      "EUER",
      `${req.jahr}${vorlaeufig ? "_vorlaeufig" : ""}`,
      "pdf",
    ),
    "application/pdf",
  );
}

async function erzeugePrivatentnahmen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  profil: ProfilRow,
  req: ExportRequest,
): Promise<NextResponse> {
  const { von, bis } = wirtschaftsjahrGrenzen(
    req.jahr,
    profil.wirtschaftsjahr_beginn,
  );
  let buchungen: Buchung[];
  let kategorien: Kategorie[];
  try {
    buchungen = await ladeBuchungenJahr(supabase, ownerId, von, bis);
    kategorien = await ladeKategorien(supabase, ownerId);
  } catch {
    return fehler("Daten konnten nicht geladen werden.", 500);
  }
  const katById = new Map(kategorien.map((k) => [k.id, k]));

  // Dedizierter, privater Export: NUR privat klassifizierte Posten bzw.
  // Buchungen mit einer Kategorie vom Typ 'privat'.
  const zeilen: PrivatentnahmeZeile[] = buchungen
    .filter((b) => {
      const kat = b.kategorie_id ? katById.get(b.kategorie_id) : undefined;
      return b.klassifikation === "privat" || kat?.typ === "privat";
    })
    .map((b) => {
      const kat = b.kategorie_id ? katById.get(b.kategorie_id) : undefined;
      return {
        datum: b.buchung_datum.slice(0, 10),
        betrag: b.betrag,
        bezeichnung: kat?.bezeichnung ?? b.empfaenger ?? "Privatentnahme",
        verwendungszweck: b.verwendungszweck ?? "",
      };
    })
    .sort((a, x) => (a.datum < x.datum ? -1 : a.datum > x.datum ? 1 : 0));

  const pdf = await privatentnahmenPdf(
    firmenKopf(profil),
    req.jahr,
    { von, bis },
    zeilen,
  );
  return datei(
    pdf,
    dateiname(profil.firmenname, "Privatentnahmen", String(req.jahr), "pdf"),
    "application/pdf",
  );
}

async function erzeugeBuchungenCsv(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  profil: ProfilRow,
  req: ExportRequest,
): Promise<NextResponse> {
  const { von, bis } = wirtschaftsjahrGrenzen(
    req.jahr,
    profil.wirtschaftsjahr_beginn,
  );
  let buchungen: Buchung[];
  let kategorien: Kategorie[];
  try {
    buchungen = await ladeBuchungenJahr(supabase, ownerId, von, bis);
    kategorien = await ladeKategorien(supabase, ownerId);
  } catch {
    return fehler("Daten konnten nicht geladen werden.", 500);
  }
  const katById = new Map(kategorien.map((k) => [k.id, k]));

  // Konto-Bezeichnung (Gegenkonto) je Buchung.
  const { data: kontoData } = await supabase
    .from("konto")
    .select("id, bezeichnung")
    .eq("owner_id", ownerId)
    .limit(1000);
  const kontoById = new Map(
    ((kontoData ?? []) as Array<{ id: string; bezeichnung: string }>).map(
      (k) => [k.id, k.bezeichnung],
    ),
  );

  // Beleg-Referenzen je Buchung (Beleg-Titel/Paperless-ID).
  const { data: bbData } = await ladeAlle((von, bisIdx) =>
    supabase
      .from("beleg_buchung")
      .select("buchung_id, beleg:beleg_id(titel, paperless_id)")
      .eq("owner_id", ownerId)
      .order("id", { ascending: true })
      .range(von, bisIdx),
  );
  const belegRef = new Map<string, string[]>();
  type BelegEmbed = { titel: string | null; paperless_id: number };
  const bbRows = (bbData ?? []) as unknown as Array<{
    buchung_id: string;
    // Supabase liefert eingebettete 1:n-Relationen als Array.
    beleg: BelegEmbed | BelegEmbed[] | null;
  }>;
  for (const r of bbRows) {
    const beleg = Array.isArray(r.beleg) ? r.beleg[0] : r.beleg;
    if (!beleg) continue;
    const ref =
      beleg.titel && beleg.titel.trim().length > 0
        ? beleg.titel
        : `Paperless#${beleg.paperless_id}`;
    const arr = belegRef.get(r.buchung_id) ?? [];
    arr.push(ref);
    belegRef.set(r.buchung_id, arr);
  }

  // Datenschutz: KEINE privaten Posten im betrieblichen Buchungsexport.
  const zeilen: BuchungsExportZeile[] = buchungen
    .filter((b) => {
      const kat = b.kategorie_id ? katById.get(b.kategorie_id) : undefined;
      return b.klassifikation !== "privat" && kat?.typ !== "privat";
    })
    .map((b) => {
      const kat = b.kategorie_id ? katById.get(b.kategorie_id) : undefined;
      const text = [b.empfaenger, b.verwendungszweck]
        .filter((s): s is string => !!s && s.trim().length > 0)
        .join(" · ");
      return {
        datum: b.buchung_datum.slice(0, 10),
        betrag: b.betrag,
        konto: kat?.bezeichnung ?? "Nicht zugeordnet",
        gegenkonto: kontoById.get(b.konto_id) ?? "",
        ust_satz: b.ust_satz,
        beleg_referenz: (belegRef.get(b.id) ?? []).join(" | "),
        buchungstext: text,
      };
    });

  const csv = buchungenAlsCsv(zeilen);
  return datei(
    csv,
    dateiname(profil.firmenname, "Buchungen", String(req.jahr), "csv"),
    "text/csv; charset=utf-8",
  );
}

// --- USt-VA / ELSTER brauchen die Periode -----------------------------------

async function ladeUstVaBerechnung(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  profil: ProfilRow,
  jahr: number,
  periode: number,
): Promise<
  | { ok: true; berechnung: UstBerechnung; vorlaeufig: boolean; label: string }
  | { ok: false; response: NextResponse }
> {
  const rhy = rhythmusVon(profil);
  const p = ustVaPeriode(jahr, periode, rhy);
  if (!p) {
    return {
      ok: false,
      response: fehler(
        "Ungültige Periode für den eingestellten Rhythmus.",
        422,
      ),
    };
  }

  // Abgeschlossene Periode → unveränderlicher Snapshot.
  const { data: periodeRow } = await supabase
    .from("steuerperiode")
    .select("status, snapshot")
    .eq("owner_id", ownerId)
    .eq("art", "ust_va")
    .eq("jahr", jahr)
    .eq("periode", periode)
    .limit(1)
    .maybeSingle();

  if (
    periodeRow &&
    (periodeRow as { status: string }).status === "abgeschlossen" &&
    (periodeRow as { snapshot: unknown }).snapshot
  ) {
    const snap = (periodeRow as { snapshot: UstBerechnung }).snapshot;
    return { ok: true, berechnung: snap, vorlaeufig: false, label: p.label };
  }

  // On-the-fly aus aktuellen Buchungen + „vorläufig".
  let alle: Buchung[];
  try {
    alle = await ladeBuchungenJahr(
      supabase,
      ownerId,
      `${jahr}-01-01`,
      `${jahr}-12-31`,
    );
  } catch {
    return {
      ok: false,
      response: fehler("Buchungen konnten nicht geladen werden.", 500),
    };
  }
  const belegteIds = await ladeBelegteIds(supabase, ownerId);
  const periodenBuchungen: UstBuchung[] = [];
  for (const b of alle) {
    const pp = periodeFuerDatum(b.buchung_datum, jahr, rhy);
    if (!pp || pp.periode !== periode) continue;
    periodenBuchungen.push({
      id: b.id,
      buchung_datum: b.buchung_datum,
      betrag: b.betrag,
      klassifikation: b.klassifikation,
      steuerrelevant: b.steuerrelevant,
      ust_satz: b.ust_satz,
      belegt: belegteIds.has(b.id),
    });
  }
  const berechnung = berechneUstVa(
    periodenBuchungen,
    jahr,
    periode,
    profil.ust_status,
  );
  return { ok: true, berechnung, vorlaeufig: true, label: p.label };
}

async function verarbeite(req: ExportRequest): Promise<NextResponse> {
  const user = await getApiUser();
  if (!user) return fehler("Nicht angemeldet.", 401);

  const supabase = await createClient();
  const profil = await ladeProfil(supabase, user.id);
  if (!profil) {
    return fehler(
      "Kein Firmenprofil gefunden. Bitte zuerst Firma & Steuerprofil pflegen.",
      409,
    );
  }

  if (req.typ === "euer") {
    return erzeugeEuer(supabase, user.id, profil, req);
  }
  if (req.typ === "privatentnahmen") {
    return erzeugePrivatentnahmen(supabase, user.id, profil, req);
  }
  if (req.typ === "buchungen") {
    return erzeugeBuchungenCsv(supabase, user.id, profil, req);
  }

  // ustva | elster — beide brauchen eine Periode (Zod garantiert sie).
  const periode = req.periode as number;
  const erg = await ladeUstVaBerechnung(
    supabase,
    user.id,
    profil,
    req.jahr,
    periode,
  );
  if (!erg.ok) return erg.response;

  const labelSlug = erg.label.replace(/\s+/g, "");

  if (req.typ === "ustva") {
    const pdf = await ustvaPdf(
      firmenKopf(profil),
      erg.berechnung,
      erg.label,
      erg.vorlaeufig,
    );
    return datei(
      pdf,
      dateiname(
        profil.firmenname,
        "USt-VA",
        `${labelSlug}${erg.vorlaeufig ? "_vorlaeufig" : ""}`,
        "pdf",
      ),
      "application/pdf",
    );
  }

  // elster: pdf oder csv
  if (req.format === "csv") {
    const zeilen: ElsterKennzahlZeile[] = erg.berechnung.zeilen.map((z) => ({
      kennzahl: z.kennzahl,
      bezeichnung: z.bezeichnung,
      betrag: z.betrag,
      steuer: z.steuer,
    }));
    const csv = elsterKennzahlenAlsCsv(zeilen);
    return datei(
      csv,
      dateiname(
        profil.firmenname,
        "ELSTER",
        `${labelSlug}${erg.vorlaeufig ? "_vorlaeufig" : ""}`,
        "csv",
      ),
      "text/csv; charset=utf-8",
    );
  }
  const pdf = await elsterPdf(
    firmenKopf(profil),
    erg.berechnung,
    erg.label,
    erg.vorlaeufig,
  );
  return datei(
    pdf,
    dateiname(
      profil.firmenname,
      "ELSTER",
      `${labelSlug}${erg.vorlaeufig ? "_vorlaeufig" : ""}`,
      "pdf",
    ),
    "application/pdf",
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fehler("Ungültiger Request-Body.", 400);
  }
  const parsed = exportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  return verarbeite(parsed.data);
}

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = exportRequestSchema.safeParse({
    typ: url.searchParams.get("typ"),
    format: url.searchParams.get("format"),
    jahr: url.searchParams.get("jahr"),
    periode: url.searchParams.get("periode") ?? undefined,
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
  return verarbeite(parsed.data);
}
