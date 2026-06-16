// PROJ-6: Beleg<->Buchung-Abgleich-API.
//
// POST  -> Re-Matching-Lauf. Legt job_lauf (art='matching') an, lädt
//          geschäftliche Buchungen + Belege + bestehende Zuordnungen, ruft die
//          reine Engine und schreibt 'auto'/'unsicher' Zuordnungen. GESPERRTE
//          (manuelle) Zuordnungen werden NIE überschrieben/gelöscht.
//          nur_offen=true (Default): nur Buchungen ohne Zuordnung. false:
//          zusätzlich nicht-gesperrte Zuordnungen neu berechnen.
// GET   -> Fehllisten + Status:
//            A: geschäftliche Buchungen ohne Beleg
//            B: Belege ohne Buchung
//            + unsichere Matches (zur Bestätigung)
//          Query-Filter: von, bis, konto, betrag_min, betrag_max.
//          ?status=1 → nur letzter job_lauf (für Polling).
//
// Auth Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import {
  fehllisteFilterSchema,
  matchingInputSchema,
} from "@/lib/matching/validation";
import {
  fuehreMatchingAus,
  DEFAULT_ENGINE_CONFIG,
  type BestehendeZuordnung,
  type BuchungFuerEngine,
  type EngineConfig,
} from "@/lib/matching/engine";
import { DEFAULT_SCORE_CONFIG, type BelegFuerScore } from "@/lib/matching/score";
import { ladeAlle } from "@/lib/supabase/fetch-all";
import { aktiverZeitraum } from "@/lib/jahr/aktives-jahr";

export const runtime = "nodejs";
export const maxDuration = 300;

const SELECT_JOB =
  "id, art, status, fortschritt, gesamt, ergebnis, fehler_text, created_at";

interface MatchErgebnis {
  geprueft: number;
  auto: number;
  unsicher: number;
  ohne_beleg: number;
  uebersprungen_gesperrt: number;
  ignoriert_nicht_geschaeftlich: number;
  geschrieben: number;
  fehler: string[];
}

// ---------------------------------------------------------------------------
// GET — Fehllisten + Status
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const supabase = await createClient();
  const url = new URL(request.url);

  // Polling-Modus: nur letzter Job.
  if (url.searchParams.get("status") === "1") {
    const { data, error } = await supabase
      .from("job_lauf")
      .select(SELECT_JOB)
      .eq("owner_id", user.id)
      .eq("art", "matching")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: "Status konnte nicht geladen werden." },
        { status: 500 },
      );
    }
    return NextResponse.json({ job: data ?? null });
  }

  const filterParsed = fehllisteFilterSchema.safeParse({
    von: url.searchParams.get("von") ?? undefined,
    bis: url.searchParams.get("bis") ?? undefined,
    konto: url.searchParams.get("konto") ?? undefined,
    betrag_min: url.searchParams.get("betrag_min") ?? undefined,
    betrag_max: url.searchParams.get("betrag_max") ?? undefined,
  });
  if (!filterParsed.success) {
    return NextResponse.json(
      {
        error: "Ungültige Filter.",
        details: filterParsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const f = filterParsed.data;

  // PROJ-22: Datumsfenster über den globalen Jahreswähler auflösen — fehlende
  // von/bis scopen so automatisch aufs aktive Jahr; explizite Grenzen werden
  // darauf geklammert. Wird wie bisher auf BEIDE Datumsspalten (buchung_datum,
  // beleg_datum) angewandt.
  const { von, bis } = await aktiverZeitraum(supabase, user.id, {
    von: f.von ?? null,
    bis: f.bis ?? null,
    jahr: null,
  });

  // Alle Zuordnungen owner-scoped (für "hat Beleg?"-Auswertung).
  // Vollständig paginiert — PostgREST deckelt sonst bei 1000 Zeilen.
  // Stabile Sortierung via id (range-Pagination erfordert deterministische Ordnung).
  const { data: bbData, error: bbErr } = await ladeAlle((vonIdx, bisIdx) =>
    supabase
      .from("beleg_buchung")
      .select(
        "id, beleg_id, buchung_id, match_score, kriterien, status, gesperrt",
      )
      .eq("owner_id", user.id)
      .order("id", { ascending: true })
      .range(vonIdx, bisIdx),
  );
  if (bbErr) {
    return NextResponse.json(
      { error: "Zuordnungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const zuordnungen = bbData ?? [];
  const buchungMitZuordnung = new Set(
    zuordnungen
      .filter((z) => z.status !== "unsicher")
      .map((z) => z.buchung_id as string),
  );
  const belegMitZuordnung = new Set(
    zuordnungen
      .filter((z) => z.status !== "unsicher")
      .map((z) => z.beleg_id as string),
  );

  // Fehlliste A: geschäftliche Buchungen, gefiltert.
  // Vollständig paginiert — id als stabiler Tiebreaker für range-Pagination.
  const { data: buchungenData, error: bErr } = await ladeAlle((vonIdx, bisIdx) => {
    let bQuery = supabase
      .from("buchung")
      .select(
        "id, konto_id, buchung_datum, betrag, verwendungszweck, empfaenger, waehrung, klassifikation",
      )
      .eq("owner_id", user.id)
      .eq("klassifikation", "geschaeftlich")
      .order("buchung_datum", { ascending: false })
      .order("id", { ascending: true });
    if (f.konto) bQuery = bQuery.eq("konto_id", f.konto);
    if (von) bQuery = bQuery.gte("buchung_datum", von);
    if (bis) bQuery = bQuery.lte("buchung_datum", bis);
    return bQuery.range(vonIdx, bisIdx);
  });
  if (bErr) {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  let geschaeftsbuchungen = buchungenData ?? [];
  if (typeof f.betrag_min === "number") {
    geschaeftsbuchungen = geschaeftsbuchungen.filter(
      (b) => Math.abs(b.betrag as number) >= f.betrag_min!,
    );
  }
  if (typeof f.betrag_max === "number") {
    geschaeftsbuchungen = geschaeftsbuchungen.filter(
      (b) => Math.abs(b.betrag as number) <= f.betrag_max!,
    );
  }
  const buchungenOhneBeleg = geschaeftsbuchungen.filter(
    (b) => !buchungMitZuordnung.has(b.id as string),
  );

  // Fehlliste B: Belege ohne (sichere) Zuordnung.
  // Vollständig paginiert — beleg_datum-Sortierung (nullsFirst) bleibt, id als
  // finaler Tiebreaker für deterministische range-Pagination.
  const { data: belegeData, error: belErr } = await ladeAlle((vonIdx, bisIdx) => {
    let belQuery = supabase
      .from("beleg")
      .select(
        "id, paperless_id, titel, beleg_datum, korrespondent, betrag, status, quell_link",
      )
      .eq("owner_id", user.id)
      .order("beleg_datum", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true });
    if (von) belQuery = belQuery.gte("beleg_datum", von);
    if (bis) belQuery = belQuery.lte("beleg_datum", bis);
    return belQuery.range(vonIdx, bisIdx);
  });
  if (belErr) {
    return NextResponse.json(
      { error: "Belege konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  let belege = belegeData ?? [];
  if (typeof f.betrag_min === "number") {
    belege = belege.filter(
      (b) => b.betrag !== null && Math.abs(b.betrag as number) >= f.betrag_min!,
    );
  }
  if (typeof f.betrag_max === "number") {
    belege = belege.filter(
      (b) => b.betrag !== null && Math.abs(b.betrag as number) <= f.betrag_max!,
    );
  }
  const belegeOhneBuchung = belege.filter(
    (b) => !belegMitZuordnung.has(b.id as string),
  );

  // Unsichere Matches anreichern (Beleg- + Buchungs-Stammdaten für die UI).
  const unsichereRoh = zuordnungen.filter((z) => z.status === "unsicher");
  const belegMap = new Map(belege.map((b) => [b.id as string, b]));
  const buchungMap = new Map(
    geschaeftsbuchungen.map((b) => [b.id as string, b]),
  );
  const unsicher = unsichereRoh.map((z) => ({
    id: z.id,
    match_score: z.match_score,
    kriterien: z.kriterien,
    beleg: belegMap.get(z.beleg_id as string) ?? null,
    buchung: buchungMap.get(z.buchung_id as string) ?? null,
  }));

  return NextResponse.json({
    fehlliste_a: buchungenOhneBeleg,
    fehlliste_b: belegeOhneBuchung,
    unsichere_matches: unsicher,
    zusammenfassung: {
      geschaeftsbuchungen: geschaeftsbuchungen.length,
      buchungen_ohne_beleg: buchungenOhneBeleg.length,
      belege_gesamt: belege.length,
      belege_ohne_buchung: belegeOhneBuchung.length,
      unsicher: unsicher.length,
    },
  });
}

// ---------------------------------------------------------------------------
// POST — Re-Matching-Lauf
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) body = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 },
    );
  }
  const parsed = matchingInputSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const { nur_offen } = parsed.data;
  const config: EngineConfig = {
    ...DEFAULT_ENGINE_CONFIG,
    betrag_abs_toleranz:
      parsed.data.betrag_abs_toleranz ?? DEFAULT_SCORE_CONFIG.betrag_abs_toleranz,
    betrag_rel_toleranz:
      parsed.data.betrag_rel_toleranz ?? DEFAULT_SCORE_CONFIG.betrag_rel_toleranz,
    datum_fenster_tage:
      parsed.data.datum_fenster_tage ?? DEFAULT_SCORE_CONFIG.datum_fenster_tage,
  };

  const supabase = await createClient();

  // Doppelstart vermeiden.
  const { data: laufend } = await supabase
    .from("job_lauf")
    .select("id")
    .eq("owner_id", user.id)
    .eq("art", "matching")
    .eq("status", "laeuft")
    .limit(1)
    .maybeSingle();
  if (laufend) {
    return NextResponse.json(
      { error: "Es läuft bereits ein Abgleich. Bitte warten." },
      { status: 409 },
    );
  }

  // Geschäftliche Buchungen laden.
  // Vollständig paginiert — id als stabiler Tiebreaker für range-Pagination.
  const { data: buchungenData, error: bErr } = await ladeAlle((von, bisIdx) =>
    supabase
      .from("buchung")
      .select(
        "id, betrag, buchung_datum, verwendungszweck, empfaenger, klassifikation",
      )
      .eq("owner_id", user.id)
      .eq("klassifikation", "geschaeftlich")
      .order("buchung_datum", { ascending: true })
      .order("id", { ascending: true })
      .range(von, bisIdx),
  );
  if (bErr) {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const buchungen = (buchungenData ?? []) as BuchungFuerEngine[];

  // Belege laden.
  // Vollständig paginiert — id als stabile Sortierung für range-Pagination.
  const { data: belegeData, error: belErr } = await ladeAlle((von, bisIdx) =>
    supabase
      .from("beleg")
      .select("id, betrag, beleg_datum, titel, korrespondent, ocr_text")
      .eq("owner_id", user.id)
      .order("id", { ascending: true })
      .range(von, bisIdx),
  );
  if (belErr) {
    return NextResponse.json(
      { error: "Belege konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const belege = (belegeData ?? []) as BelegFuerScore[];

  // Bestehende Zuordnungen (gesperrte schützen, offene ggf. neu rechnen).
  // Vollständig paginiert — id als stabile Sortierung für range-Pagination.
  const { data: bbData, error: bbErr } = await ladeAlle((von, bisIdx) =>
    supabase
      .from("beleg_buchung")
      .select("id, beleg_id, buchung_id, status, gesperrt")
      .eq("owner_id", user.id)
      .order("id", { ascending: true })
      .range(von, bisIdx),
  );
  if (bbErr) {
    return NextResponse.json(
      { error: "Zuordnungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const alleZuordnungen = bbData ?? [];
  const bestehende: BestehendeZuordnung[] = alleZuordnungen.map((z) => ({
    beleg_id: z.beleg_id as string,
    buchung_id: z.buchung_id as string,
    gesperrt: z.gesperrt as boolean,
  }));

  // Engine-Lauf (rein in-memory).
  const lauf = fuehreMatchingAus(buchungen, belege, bestehende, config);

  // job_lauf anlegen.
  const { data: jobRow, error: jobErr } = await supabase
    .from("job_lauf")
    .insert({
      owner_id: user.id,
      art: "matching",
      status: "laeuft",
      fortschritt: 0,
      gesamt: lauf.vorschlaege.length,
    })
    .select("id")
    .single();
  if (jobErr || !jobRow) {
    return NextResponse.json(
      { error: "Abgleich-Job konnte nicht angelegt werden." },
      { status: 500 },
    );
  }
  const jobId = (jobRow as { id: string }).id;

  const ergebnis: MatchErgebnis = {
    geprueft: lauf.statistik.geprueft,
    auto: lauf.statistik.auto,
    unsicher: lauf.statistik.unsicher,
    ohne_beleg: lauf.statistik.ohne_beleg,
    uebersprungen_gesperrt: lauf.statistik.uebersprungen_gesperrt,
    ignoriert_nicht_geschaeftlich:
      lauf.statistik.ignoriert_nicht_geschaeftlich,
    geschrieben: 0,
    fehler: [],
  };

  try {
    // Nicht-gesperrte vorhandene Zuordnungen entfernen, die neu berechnet
    // werden. Gesperrte (manuelle) NIE anfassen.
    const gesperrteBuchungen = new Set(
      bestehende.filter((z) => z.gesperrt).map((z) => z.buchung_id),
    );
    const betroffeneBuchungen = new Set(
      lauf.vorschlaege.map((v) => v.buchung_id),
    );
    const zuLoeschen = alleZuordnungen.filter(
      (z) =>
        !z.gesperrt &&
        (nur_offen
          ? betroffeneBuchungen.has(z.buchung_id as string)
          : !gesperrteBuchungen.has(z.buchung_id as string)),
    );
    if (zuLoeschen.length > 0) {
      const ids = zuLoeschen.map((z) => z.id as string);
      const { error: delErr } = await supabase
        .from("beleg_buchung")
        .delete()
        .eq("owner_id", user.id)
        .eq("gesperrt", false)
        .in("id", ids);
      if (delErr) {
        ergebnis.fehler.push("Alte Zuordnungen konnten nicht entfernt werden.");
      }
    }

    // Neue Vorschläge schreiben (Konflikte mit gesperrten überspringen).
    let i = 0;
    for (const v of lauf.vorschlaege) {
      if (gesperrteBuchungen.has(v.buchung_id)) {
        i++;
        continue;
      }
      const { error: insErr } = await supabase.from("beleg_buchung").upsert(
        {
          owner_id: user.id,
          beleg_id: v.beleg_id,
          buchung_id: v.buchung_id,
          match_score: v.match_score,
          kriterien: v.kriterien as unknown as Record<string, unknown>,
          status: v.status,
          gesperrt: false,
        },
        { onConflict: "owner_id,beleg_id,buchung_id", ignoreDuplicates: false },
      );
      if (insErr) {
        ergebnis.fehler.push(
          `Zuordnung Buchung ${v.buchung_id} konnte nicht gespeichert werden.`,
        );
      } else {
        ergebnis.geschrieben++;
      }
      i++;
      if (i % 20 === 0 || i === lauf.vorschlaege.length) {
        await supabase
          .from("job_lauf")
          .update({ fortschritt: i })
          .eq("id", jobId)
          .eq("owner_id", user.id);
      }
    }

    await supabase
      .from("job_lauf")
      .update({
        status: "fertig",
        fortschritt: lauf.vorschlaege.length,
        gesamt: lauf.vorschlaege.length,
        ergebnis: ergebnis as unknown as Record<string, unknown>,
      })
      .eq("id", jobId)
      .eq("owner_id", user.id);

    return NextResponse.json({ ok: true, job_id: jobId, ergebnis });
  } catch (err) {
    const fehlerText =
      err instanceof Error ? err.message : "Unbekannter Fehler.";
    await supabase
      .from("job_lauf")
      .update({
        status: "fehler",
        fehler_text: fehlerText,
        ergebnis: ergebnis as unknown as Record<string, unknown>,
      })
      .eq("id", jobId)
      .eq("owner_id", user.id);
    return NextResponse.json(
      { error: fehlerText, job_id: jobId, ergebnis },
      { status: 500 },
    );
  }
}
