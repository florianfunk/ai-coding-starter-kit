// PROJ-5: Klassifizierungs-Pipeline-Trigger (serverseitig, LLM-Proxy).
//
// POST  -> startet die Massen-Klassifizierung. Legt job_lauf
//          (art='klassifizierung') an, läuft synchron (MVP) über alle
//          Buchungen mit status='offen' (oder bei nur_offen=false alle
//          AUSSER 'manuell_bestaetigt' = Re-Klassifizierung). Regeln zuerst,
//          dann LLM, dann Konfidenz-Bewertung. Jede Entscheidung →
//          audit_eintrag. LLM-Ausfall einzelner Buchungen → 'zur_pruefung',
//          bricht den Lauf NICHT ab (kein Datenverlust).
// GET   -> letzter/aktueller Klassifizierungs-Status (job_lauf).
//
// Auth Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS.
// LLM läuft ausschließlich hier serverseitig.

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { klassifizierungInputSchema } from "@/lib/validation/klassifizierung";
import {
  klassifiziereBuchung,
  ManuellBestaetigtError,
  type BuchungFuerPipeline,
  type PipelineConfig,
} from "@/lib/classifier/pipeline";
import type { KategorieOption } from "@/lib/classifier/llm";
import type { Lernregel } from "@/lib/types";

export const runtime = "nodejs";
// Massen-Klassifizierung mit LLM-Aufrufen kann dauern.
export const maxDuration = 300;

const SELECT_JOB =
  "id, art, status, fortschritt, gesamt, ergebnis, fehler_text, created_at";

const SELECT_BUCHUNG =
  "id, konto_id, betrag, verwendungszweck, empfaenger, status";

interface Klassifikationsergebnis {
  verarbeitet: number;
  auto_verbucht: number;
  zur_pruefung: number;
  via_regel: number;
  via_ki: number;
  uebersprungen_manuell: number;
  fehler: Array<{ buchung_id: string; grund: string }>;
}

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_lauf")
    .select(SELECT_JOB)
    .eq("owner_id", user.id)
    .eq("art", "klassifizierung")
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

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  // Body optional; ?nur_offen=false als Query-Alternative.
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
  const urlNurOffen = new URL(request.url).searchParams.get("nur_offen");
  if (
    urlNurOffen !== null &&
    typeof (body as Record<string, unknown>).nur_offen === "undefined"
  ) {
    (body as Record<string, unknown>).nur_offen =
      urlNurOffen !== "false" && urlNurOffen !== "0";
  }

  const parsed = klassifizierungInputSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const { nur_offen, konfidenz_schwellwert, betrag_limit } = parsed.data;
  // Default-Kategorien für die Pipeline werden weiter unten ermittelt
  // (nachdem Kategorien geladen wurden) und in `config` ergänzt.
  const config: PipelineConfig = {
    konfidenz_schwellwert,
    betrag_limit,
  };

  const supabase = await createClient();

  // Doppelstart vermeiden.
  const { data: laufend } = await supabase
    .from("job_lauf")
    .select("id")
    .eq("owner_id", user.id)
    .eq("art", "klassifizierung")
    .eq("status", "laeuft")
    .limit(1)
    .maybeSingle();
  if (laufend) {
    return NextResponse.json(
      {
        error:
          "Es läuft bereits eine Klassifizierung. Bitte warte, bis sie fertig ist.",
      },
      { status: 409 },
    );
  }

  // Lernregeln + Kategorien einmalig laden (owner-scoped).
  const { data: regelnData, error: regelnErr } = await supabase
    .from("lernregel")
    .select(
      "id, bezeichnung, bedingung, aktion, prioritaet, aktiv, treffer_zaehler",
    )
    .eq("owner_id", user.id)
    .eq("aktiv", true)
    .order("prioritaet", { ascending: false })
    .limit(1000);
  if (regelnErr) {
    return NextResponse.json(
      { error: "Lernregeln konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const regeln = (regelnData ?? []) as Lernregel[];

  const { data: katData, error: katErr } = await supabase
    .from("kategorie")
    .select("id, bezeichnung, typ")
    .eq("owner_id", user.id)
    .eq("aktiv", true)
    .limit(500);
  if (katErr) {
    return NextResponse.json(
      { error: "Kategorien konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const kategorien = (katData ?? []) as KategorieOption[];

  // Pipeline-Fallback: Default-Kategorien für privat/neutral identifizieren.
  // Konvention: die Standard-Seed-Kategorien "Privatentnahme" (typ=privat)
  // und "Geldtransit (Umbuchung zwischen Konten)" (typ=neutral).
  // Wenn die KI klar privat/neutral klassifiziert aber keine spezifische
  // Unterkategorie wählt, fallen wir auf diese Defaults zurück.
  const defaultPrivat = kategorien.find(
    (k) =>
      k.typ === "privat" &&
      k.bezeichnung.toLowerCase() === "privatentnahme",
  );
  const defaultNeutral = kategorien.find(
    (k) =>
      k.typ === "neutral" &&
      k.bezeichnung.toLowerCase().startsWith("geldtransit"),
  );
  if (defaultPrivat || defaultNeutral) {
    config.default_kategorie = {
      ...(defaultPrivat ? { privat: defaultPrivat.id } : {}),
      ...(defaultNeutral ? { neutral: defaultNeutral.id } : {}),
    };
  }

  // Zu klassifizierende Buchungen.
  let buchungQuery = supabase
    .from("buchung")
    .select(SELECT_BUCHUNG)
    .eq("owner_id", user.id)
    .order("buchung_datum", { ascending: true })
    .limit(5000);
  if (nur_offen) {
    buchungQuery = buchungQuery.eq("status", "offen");
  } else {
    // Re-Klassifizierung: alles AUSSER manuell bestätigt.
    buchungQuery = buchungQuery.neq("status", "manuell_bestaetigt");
  }
  const { data: buchungenData, error: buchungenErr } = await buchungQuery;
  if (buchungenErr) {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const buchungen = (buchungenData ?? []) as BuchungFuerPipeline[];

  // job_lauf anlegen.
  const { data: jobRow, error: jobErr } = await supabase
    .from("job_lauf")
    .insert({
      owner_id: user.id,
      art: "klassifizierung",
      status: "laeuft",
      fortschritt: 0,
      gesamt: buchungen.length,
    })
    .select("id")
    .single();
  if (jobErr || !jobRow) {
    return NextResponse.json(
      { error: "Klassifizierungs-Job konnte nicht angelegt werden." },
      { status: 500 },
    );
  }
  const jobId = (jobRow as { id: string }).id;

  const ergebnis: Klassifikationsergebnis = {
    verarbeitet: 0,
    auto_verbucht: 0,
    zur_pruefung: 0,
    via_regel: 0,
    via_ki: 0,
    uebersprungen_manuell: 0,
    fehler: [],
  };
  // Trefferzähler je angewandter Regel (am Ende gebündelt erhöhen).
  const regelTreffer = new Map<string, number>();

  try {
    for (let i = 0; i < buchungen.length; i++) {
      const b = buchungen[i];
      try {
        const { ergebnis: e, audit } = await klassifiziereBuchung(
          b,
          regeln,
          kategorien,
          config,
        );

        const { error: updErr } = await supabase
          .from("buchung")
          .update({
            klassifikation: e.klassifikation,
            steuerrelevant: e.steuerrelevant,
            kategorie_id: e.kategorie_id,
            ust_satz: e.ust_satz,
            begruendung: e.begruendung,
            konfidenz: e.konfidenz,
            quelle: e.quelle,
            regel_id: e.regel_id,
            status: e.status,
            pruef_grund: e.pruef_grund,
          })
          .eq("id", b.id)
          .eq("owner_id", user.id)
          .neq("status", "manuell_bestaetigt"); // letzte Sicherung

        if (updErr) {
          ergebnis.fehler.push({
            buchung_id: b.id,
            grund: "Buchung konnte nicht aktualisiert werden.",
          });
          continue;
        }

        await supabase.from("audit_eintrag").insert({
          owner_id: user.id,
          entitaet: "buchung",
          entitaet_id: b.id,
          aktion: audit.aktion,
          quelle: audit.quelle,
          details: audit.details,
        });

        ergebnis.verarbeitet++;
        if (e.status === "auto_verbucht") ergebnis.auto_verbucht++;
        else ergebnis.zur_pruefung++;
        if (e.quelle === "regel") {
          ergebnis.via_regel++;
          if (e.regel_id) {
            regelTreffer.set(
              e.regel_id,
              (regelTreffer.get(e.regel_id) ?? 0) + 1,
            );
          }
        } else {
          ergebnis.via_ki++;
        }
      } catch (err) {
        if (err instanceof ManuellBestaetigtError) {
          ergebnis.uebersprungen_manuell++;
        } else {
          ergebnis.fehler.push({
            buchung_id: b.id,
            grund:
              err instanceof Error ? err.message : "Unbekannter Fehler.",
          });
        }
      }

      // Fortschritt regelmäßig pflegen (nicht bei jeder Zeile).
      if (i % 10 === 0 || i === buchungen.length - 1) {
        await supabase
          .from("job_lauf")
          .update({ fortschritt: i + 1 })
          .eq("id", jobId)
          .eq("owner_id", user.id);
      }
    }

    // Trefferzähler der angewandten Regeln erhöhen.
    for (const [regelId, anzahl] of regelTreffer) {
      const treffer = regeln.find((r) => r.id === regelId);
      if (treffer) {
        await supabase
          .from("lernregel")
          .update({ treffer_zaehler: treffer.treffer_zaehler + anzahl })
          .eq("id", regelId)
          .eq("owner_id", user.id);
      }
    }

    await supabase
      .from("job_lauf")
      .update({
        status: "fertig",
        fortschritt: buchungen.length,
        gesamt: buchungen.length,
        ergebnis: ergebnis as unknown as Record<string, unknown>,
      })
      .eq("id", jobId)
      .eq("owner_id", user.id);

    return NextResponse.json({ ok: true, job_id: jobId, ergebnis });
  } catch (err) {
    const fehlerText =
      err instanceof Error ? err.message : "Unbekannter Fehler.";
    // Teil-Ergebnis NICHT verwerfen.
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
