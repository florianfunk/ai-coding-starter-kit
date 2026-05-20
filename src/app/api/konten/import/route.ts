// PROJ-4: Kontoauszug-Import (Excel/CSV).
//
// POST (multipart/form-data):
//   - file:     hochgeladene .xlsx / .csv Datei
//   - konto_id: Ziel-Konto (UUID)
//   - mapping:  optionales Ad-hoc-Mapping (JSON-String) — überschreibt das
//               gespeicherte Konto-Mapping nur für diesen Import
//   - preview:  "1" → nur Vorschau, KEIN DB-Insert
//
// Ablauf: Datei parsen (lib/importer/parser, rein) → Duplikate gegen
// vorhandene buchung.duplikat_hash erkennen → neue Buchungen mit
// status 'offen' inserten → job_lauf (art='konto_import') protokollieren.
// Klassifizierungsfelder bleiben leer (füllt PROJ-5).
//
// Auth Pflicht (getApiUser → 401). Alles owner-scoped + RLS.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { kontoMappingSchema } from "@/lib/validation/konto";
import { parseKontoauszug } from "@/lib/importer/parser";
import { normalisiereEmpfaenger } from "@/lib/classifier/normalize";
import type { KontoMapping } from "@/lib/types";

export const runtime = "nodejs";

// Obergrenze für hochgeladene Dateien (Kontoauszüge sind klein).
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ERLAUBTE_ENDUNGEN = [".xlsx", ".xls", ".csv"];

interface VorschauZeile {
  buchung_datum: string;
  betrag: number;
  verwendungszweck: string | null;
  empfaenger: string | null;
  waehrung: string;
  duplikat_hash: string;
  duplikat: boolean;
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Erwarte multipart/form-data" },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const kontoId = form.get("konto_id");
  const mappingRaw = form.get("mapping");
  const previewParam =
    form.get("preview") ??
    new URL(request.url).searchParams.get("preview");
  const preview = previewParam === "1" || previewParam === "true";

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Keine Datei übermittelt" },
      { status: 400 },
    );
  }
  if (typeof kontoId !== "string" || kontoId.trim() === "") {
    return NextResponse.json(
      { error: "konto_id fehlt" },
      { status: 400 },
    );
  }

  const name = file.name.toLowerCase();
  if (!ERLAUBTE_ENDUNGEN.some((e) => name.endsWith(e))) {
    return NextResponse.json(
      { error: "Nur Excel (.xlsx/.xls) oder CSV erlaubt" },
      { status: 415 },
    );
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "Datei ist leer" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Datei zu groß (max. 10 MB)" },
      { status: 413 },
    );
  }

  const supabase = await createClient();

  // Konto laden (owner-scoped) — liefert auch das gespeicherte Mapping.
  const { data: konto, error: kontoErr } = await supabase
    .from("konto")
    .select("id, bezeichnung, typ, mapping")
    .eq("id", kontoId)
    .eq("owner_id", user.id)
    .single();

  if (kontoErr || !konto) {
    return NextResponse.json(
      { error: "Konto nicht gefunden" },
      { status: 404 },
    );
  }

  // Mapping bestimmen: Ad-hoc-Mapping aus FormData hat Vorrang, sonst
  // gespeichertes Konto-Mapping.
  let mapping: KontoMapping | null = (konto.mapping ??
    null) as KontoMapping | null;

  if (typeof mappingRaw === "string" && mappingRaw.trim() !== "") {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(mappingRaw);
    } catch {
      return NextResponse.json(
        { error: "Mapping ist kein gültiges JSON" },
        { status: 400 },
      );
    }
    const mappingCheck = kontoMappingSchema.safeParse(parsedJson);
    if (!mappingCheck.success) {
      return NextResponse.json(
        {
          error: "Mapping-Validierung fehlgeschlagen",
          details: mappingCheck.error.flatten().fieldErrors,
        },
        { status: 422 },
      );
    }
    mapping = mappingCheck.data as KontoMapping;
  }

  if (!mapping) {
    return NextResponse.json(
      {
        error:
          "Für dieses Konto ist noch kein Spalten-Mapping hinterlegt. Bitte zuerst ein Mapping konfigurieren.",
      },
      { status: 422 },
    );
  }

  // Datei parsen (reine Funktion, kein IO).
  const buffer = new Uint8Array(await file.arrayBuffer());
  const ergebnis = parseKontoauszug(buffer, mapping, konto.id);

  // Wenn gar nichts erkannt wurde und nur Fehler vorliegen → Mapping falsch.
  if (ergebnis.buchungen.length === 0 && ergebnis.fehlerhaft.length > 0) {
    return NextResponse.json(
      {
        error:
          "Keine gültigen Buchungen erkannt. Prüfe das Spalten-Mapping für dieses Konto.",
        protokoll: {
          importiert: 0,
          uebersprungen: 0,
          fehlerhaft: ergebnis.fehlerhaft.length,
        },
        fehler: ergebnis.fehlerhaft.slice(0, 50),
        spalten: ergebnis.spalten,
      },
      { status: 422 },
    );
  }

  // Duplikaterkennung gegen vorhandene buchung.duplikat_hash (owner-scoped).
  const hashes = ergebnis.buchungen.map((b) => b.duplikat_hash);
  const vorhanden = new Set<string>();
  if (hashes.length > 0) {
    const { data: existierende, error: dupErr } = await supabase
      .from("buchung")
      .select("duplikat_hash")
      .eq("owner_id", user.id)
      .in("duplikat_hash", hashes)
      .limit(hashes.length);
    if (dupErr) {
      return NextResponse.json(
        { error: "Duplikatprüfung fehlgeschlagen" },
        { status: 500 },
      );
    }
    for (const row of existierende ?? []) {
      vorhanden.add(row.duplikat_hash as string);
    }
  }

  // Innerhalb der Datei selbst doppelte Zeilen ebenfalls nur einmal nehmen.
  const gesehen = new Set<string>();
  const vorschau: VorschauZeile[] = [];
  for (const b of ergebnis.buchungen) {
    const istDuplikat =
      vorhanden.has(b.duplikat_hash) || gesehen.has(b.duplikat_hash);
    if (!istDuplikat) gesehen.add(b.duplikat_hash);
    vorschau.push({ ...b, duplikat: istDuplikat });
  }

  const neueZeilen = vorschau.filter((z) => !z.duplikat);
  const uebersprungen = vorschau.length - neueZeilen.length;

  // Vorschau-Modus: nichts persistieren.
  if (preview) {
    return NextResponse.json({
      preview: true,
      konto: { id: konto.id, bezeichnung: konto.bezeichnung, typ: konto.typ },
      protokoll: {
        importiert: neueZeilen.length,
        uebersprungen,
        fehlerhaft: ergebnis.fehlerhaft.length,
      },
      zeilen: vorschau.slice(0, 500),
      fehler: ergebnis.fehlerhaft.slice(0, 50),
      spalten: ergebnis.spalten,
    });
  }

  // job_lauf anlegen (Protokoll-Eintrag).
  const { data: job } = await supabase
    .from("job_lauf")
    .insert({
      owner_id: user.id,
      art: "konto_import",
      status: "laeuft",
      gesamt: vorschau.length,
    })
    .select("id")
    .single();

  let importiert = 0;
  if (neueZeilen.length > 0) {
    const rows = neueZeilen.map((z) => ({
      owner_id: user.id,
      konto_id: konto.id,
      buchung_datum: z.buchung_datum,
      betrag: z.betrag,
      verwendungszweck: z.verwendungszweck,
      empfaenger: z.empfaenger,
      // PROJ-15: stabilen Vergleichs-/Cache-Schluessel direkt mitschreiben,
      // damit nachgelagerte Stufen (Regeln, Empfaenger-Kenntnis, Historie)
      // ab dem ersten Import treffen.
      empfaenger_normalisiert: normalisiereEmpfaenger(z.empfaenger),
      waehrung: z.waehrung,
      duplikat_hash: z.duplikat_hash,
      import_quelle: file.name,
      status: "offen",
    }));

    // onConflict: parallele/überlappende Importe — bereits vorhandene
    // (owner_id, duplikat_hash) werden ignoriert statt zu fehlern.
    const { data: inserted, error: insErr } = await supabase
      .from("buchung")
      .upsert(rows, {
        onConflict: "owner_id,duplikat_hash",
        ignoreDuplicates: true,
      })
      .select("id");

    if (insErr) {
      if (job) {
        await supabase
          .from("job_lauf")
          .update({
            status: "fehler",
            fehler_text: "Buchungen konnten nicht gespeichert werden",
          })
          .eq("id", job.id)
          .eq("owner_id", user.id);
      }
      return NextResponse.json(
        { error: "Buchungen konnten nicht gespeichert werden" },
        { status: 500 },
      );
    }
    importiert = inserted?.length ?? 0;
  }

  // Zeilen, die per DB-Constraint doch noch als Duplikat erkannt wurden.
  const tatsaechlichUebersprungen =
    uebersprungen + (neueZeilen.length - importiert);

  const protokoll = {
    importiert,
    uebersprungen: tatsaechlichUebersprungen,
    fehlerhaft: ergebnis.fehlerhaft.length,
  };

  if (job) {
    await supabase
      .from("job_lauf")
      .update({
        status: "fertig",
        fortschritt: vorschau.length,
        ergebnis: protokoll,
      })
      .eq("id", job.id)
      .eq("owner_id", user.id);
  }

  return NextResponse.json({
    preview: false,
    konto: { id: konto.id, bezeichnung: konto.bezeichnung, typ: konto.typ },
    protokoll,
    fehler: ergebnis.fehlerhaft.slice(0, 50),
  });
}
