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
import { ladeAlle, ladeNachBloecken } from "@/lib/supabase/fetch-all";
import {
  klassifiziereBuchung,
  ManuellBestaetigtError,
  type BuchungFuerPipeline,
  type PipelineConfig,
} from "@/lib/classifier/pipeline";
import { neueInflightMap } from "@/lib/classifier/empfaenger-cache";
import {
  baueVorjahrUebernahmeMap,
  type FinalBuchungZeile,
} from "@/lib/classifier/vorjahres-uebernahme";
import { wendeKonsistenzPassAn } from "@/lib/classifier/konsistenz-pass";
import type { KonsistenzPassResultat } from "@/lib/classifier/konsistenz-pass";
import type { KategorieOption } from "@/lib/classifier/llm";
import type { Lernregel } from "@/lib/types";
import { holeProfil, profilHatInhalt } from "@/lib/classifier/profil";

export const runtime = "nodejs";
// Massen-Klassifizierung mit LLM-Aufrufen kann dauern.
export const maxDuration = 300;

const SELECT_JOB =
  "id, art, status, fortschritt, gesamt, ergebnis, fehler_text, created_at";

// PROJ-15: `empfaenger_normalisiert` wird mitgeladen, damit Cache/Historie
// owner-scoped pro normalisiertem Empfaenger nachschlagen koennen.
// PROJ-16: `buchung_datum` zusaetzlich, damit Arbeitgeber-Zeitraeume
// (aktiv_von/bis) gepruft werden koennen.
// PROJ-15 P1: `waehrung` + `duplikat_hash` mitladen — die Pipeline braucht sie
// fuer die automatische Split-Aktion (Kind-Buchungen erben sie von der Klammer).
const SELECT_BUCHUNG =
  "id, konto_id, betrag, verwendungszweck, empfaenger, empfaenger_normalisiert, buchung_datum, waehrung, duplikat_hash, status";

interface Klassifikationsergebnis {
  verarbeitet: number;
  auto_verbucht: number;
  zur_pruefung: number;
  via_regel: number;
  via_ki: number;
  /** PROJ-23: aus eindeutiger Vorjahres-/Historie-Kategorisierung übernommen. */
  via_vorjahr: number;
  uebersprungen_manuell: number;
  fehler: Array<{ buchung_id: string; grund: string }>;
  /**
   * PROJ-15 (Konsistenz-Pro): Phase-2-Statistik aus dem Konsistenz-Pass,
   * der nach der Hauptschleife laeuft. `null`, wenn der Pass uebersprungen
   * oder die Hauptphase frueh abgebrochen wurde.
   */
  konsistenz_pass?: KonsistenzPassResultat | null;
  /**
   * PROJ-16: True, wenn das Mein-Profil mindestens einen Eintrag hat und
   * der Pipeline durchgereicht wurde. UI-Hinweis, damit der Nutzer sieht,
   * dass der LLM-Kontext mit Stammdaten angereichert war.
   */
  mein_profil_geladen?: boolean;
  /**
   * True, wenn der Lauf wegen des Zeitbudgets (Serverless-Timeout-Schutz)
   * vorzeitig sauber beendet wurde. Die restlichen Buchungen bleiben 'offen'
   * und werden beim nächsten Start weiterverarbeitet.
   */
  zeitlimit_erreicht?: boolean;
  /** Verbleibende, noch nicht verarbeitete Buchungen bei Zeitlimit-Abbruch. */
  verbleibend?: number;
}

// Zeitbudget für die synchrone Hauptschleife. Liegt bewusst unter maxDuration
// (300 s), damit die Funktion IMMER sauber zurückkehrt (Job → 'fertig') statt
// vom Plattform-Timeout gekillt zu werden und als Zombie 'laeuft' hängen zu
// bleiben. Rest bleibt 'offen' → nächster Lauf macht weiter.
const ZEIT_BUDGET_MS = 210_000;
// Ab diesem Alter gilt ein 'laeuft'-Job als tot (Funktion kann nicht länger als
// maxDuration laufen) → darf überschrieben/freigegeben werden.
const STALE_LAEUFT_MS = 6 * 60 * 1000;

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

  // Zombie-Schutz: ein 'laeuft'-Job, der älter als das Funktions-Limit ist,
  // wurde von der Plattform gekillt und wird nie 'fertig'. Hier sauber auf
  // 'fehler' setzen, damit die UI nicht ewig „Läuft…" anzeigt und ein
  // Neustart möglich ist.
  const job = data as
    | { id: string; status: string; created_at: string }
    | null;
  if (job && istStaleLaeuft(job.status, job.created_at)) {
    await supabase
      .from("job_lauf")
      .update({
        status: "fehler",
        fehler_text:
          "Abgebrochen: Funktions-Zeitlimit überschritten (Lauf nicht abgeschlossen). Bitte erneut starten.",
      })
      .eq("id", job.id)
      .eq("owner_id", user.id);
    job.status = "fehler";
  }

  return NextResponse.json({ job: job ?? null });
}

/** True, wenn ein 'laeuft'-Job so alt ist, dass die Funktion längst tot ist. */
function istStaleLaeuft(status: string, createdAt: string): boolean {
  if (status !== "laeuft") return false;
  const alter = Date.now() - new Date(createdAt).getTime();
  return alter > STALE_LAEUFT_MS;
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
  const { nur_offen, konfidenz_schwellwert, betrag_limit, buchung_ids } =
    parsed.data;
  // PROJ-15 P2 (#1): Gezielte Re-Klassifizierung. Wenn eine explizite Liste
  // übergeben wurde, gewinnt sie über nur_offen — es werden ausschließlich
  // diese Buchungen verarbeitet (manuell_bestaetigt bleibt dabei ausgeschlossen,
  // siehe Lade-Query + Update-Guard).
  const explizitIds =
    buchung_ids && buchung_ids.length > 0 ? buchung_ids : null;
  // Default-Kategorien für die Pipeline werden weiter unten ermittelt
  // (nachdem Kategorien geladen wurden) und in `config` ergänzt.
  const config: PipelineConfig = {
    konfidenz_schwellwert,
    betrag_limit,
  };

  const supabase = await createClient();

  // Doppelstart vermeiden — aber tote Zombie-Jobs nicht ewig blockieren lassen.
  const { data: laufend } = await supabase
    .from("job_lauf")
    .select("id, created_at")
    .eq("owner_id", user.id)
    .eq("art", "klassifizierung")
    .eq("status", "laeuft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (laufend) {
    const lr = laufend as { id: string; created_at: string };
    if (istStaleLaeuft("laeuft", lr.created_at)) {
      // Toter Lauf (Funktions-Timeout) → freigeben und neuen Lauf zulassen.
      await supabase
        .from("job_lauf")
        .update({
          status: "fehler",
          fehler_text:
            "Abgebrochen: Funktions-Zeitlimit überschritten — durch Neustart ersetzt.",
        })
        .eq("id", lr.id)
        .eq("owner_id", user.id);
    } else {
      return NextResponse.json(
        {
          error:
            "Es läuft bereits eine Klassifizierung. Bitte warte, bis sie fertig ist.",
        },
        { status: 409 },
      );
    }
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

  // Zu klassifizierende Buchungen laden.
  // PROJ-15 P2 (#1): Bei expliziter Auswahl nur diese IDs (owner-scoped),
  // blockweise über .in() geladen (URL-längen-sicher), manuell_bestaetigt
  // bleibt ausgeschlossen. Sonst der reguläre, voll paginierte Lauf.
  const { data: buchungenData, error: buchungenErr } = explizitIds
    ? await ladeNachBloecken(explizitIds, (block) =>
        supabase
          .from("buchung")
          .select(SELECT_BUCHUNG)
          .eq("owner_id", user.id)
          .in("id", block)
          .neq("status", "manuell_bestaetigt")
          .order("buchung_datum", { ascending: true })
          .order("id", { ascending: true }),
      )
    : await ladeAlle((von, bisIdx) => {
        let q = supabase
          .from("buchung")
          .select(SELECT_BUCHUNG)
          .eq("owner_id", user.id)
          .order("buchung_datum", { ascending: true })
          .order("id", { ascending: true })
          .range(von, bisIdx);
        if (nur_offen) {
          q = q.eq("status", "offen");
        } else {
          // Re-Klassifizierung: alles AUSSER manuell bestätigt.
          q = q.neq("status", "manuell_bestaetigt");
        }
        return q;
      });
  if (buchungenErr) {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const buchungen = (buchungenData ?? []) as BuchungFuerPipeline[];

  // PROJ-23: Vorjahres-Übernahme-Map aus bereits FINAL verbuchten Buchungen
  // bauen (auto_verbucht/manuell_bestaetigt — typ. die Vorjahres-Daten, z. B.
  // 2026). Greift in der Pipeline nach den Regeln und vor dem LLM. Einmal pro
  // Job geladen; nicht jahres-gefiltert, damit die neuen (offenen) Buchungen
  // die eindeutige Kategorisierung des Vorjahres erben.
  const { data: finalData } = await ladeAlle((von, bisIdx) =>
    supabase
      .from("buchung")
      .select(
        "empfaenger_normalisiert, kategorie_id, klassifikation, steuerrelevant, ust_satz, status",
      )
      .eq("owner_id", user.id)
      .in("status", ["auto_verbucht", "manuell_bestaetigt"])
      .order("id", { ascending: true })
      .range(von, bisIdx),
  );
  const vorjahrMap = baueVorjahrUebernahmeMap(
    (finalData ?? []) as FinalBuchungZeile[],
  );

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

  // PROJ-16: Mein Profil EINMAL pro Job laden und in den PipelineKontext
  // haengen. Pipeline benutzt es als LLM-Kontext-Block, filtert Familien-
  // Empfaenger aus dem Web-Lookup und leitet einen Profil-Hinweis fuer
  // klare Arbeitgeber-Lohn-Buchungen ab.
  const meinProfil = await holeProfil(supabase, user.id);
  const profilGeladen = profilHatInhalt(meinProfil);

  const ergebnis: Klassifikationsergebnis = {
    verarbeitet: 0,
    auto_verbucht: 0,
    zur_pruefung: 0,
    via_regel: 0,
    via_ki: 0,
    via_vorjahr: 0,
    uebersprungen_manuell: 0,
    fehler: [],
    konsistenz_pass: null,
    mein_profil_geladen: profilGeladen,
  };
  // Trefferzähler je angewandter Regel (am Ende gebündelt erhöhen).
  const regelTreffer = new Map<string, number>();

  // PROJ-15: Job-scoped InflightMap fuer Race-Schutz beim Massen-Lauf.
  // Wenn 50 Buchungen denselben unbekannten Empfaenger haben, teilen sie
  // sich genau einen Firecrawl-Call. Bewusst hier (job-scoped) statt
  // als Modul-Singleton in empfaenger-cache.ts: Tests muessen nichts
  // mocken, parallele Jobs blockieren sich nicht, kein Memory-Leak ueber
  // die Server-Lebenszeit.
  const inflight = neueInflightMap();

  const startMs = Date.now();
  let zeitlimitErreicht = false;

  try {
    for (let i = 0; i < buchungen.length; i++) {
      // Zeitbudget-Schutz: vor jeder Buchung prüfen, ob noch Zeit ist. Sonst
      // sauber abbrechen (Job wird unten als 'fertig' markiert), Rest bleibt
      // 'offen' für den nächsten Lauf — kein Funktions-Timeout, kein Zombie.
      if (Date.now() - startMs > ZEIT_BUDGET_MS) {
        zeitlimitErreicht = true;
        ergebnis.verbleibend = buchungen.length - i;
        break;
      }
      const b = buchungen[i];
      try {
        const { ergebnis: e, audit } = await klassifiziereBuchung(
          b,
          regeln,
          kategorien,
          config,
          undefined,
          undefined,
          { supabase, ownerId: user.id, inflight, vorjahr_map: vorjahrMap },
        );

        // PROJ-15 P1: Hat eine Split-Regel gegriffen, hat die Pipeline die
        // Eltern-Buchung bereits zur Klammer gemacht und zwei Kinder angelegt
        // (via wendeSplitAn). Ein normales Update wuerde die Klammer wieder
        // ueberschreiben — daher hier ueberspringen.
        const updErr = e.split_angewandt
          ? null
          : (
              await supabase
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
                .neq("status", "manuell_bestaetigt") // letzte Sicherung
            ).error;

        if (updErr) {
          // Serverseitig die echte DB-Ursache loggen (z. B. CHECK-Constraint),
          // damit stille Schreibfehler nicht mehr unentdeckt bleiben.
          console.error(
            "[klassifizierung] update fehlgeschlagen",
            b.id,
            "quelle=" + e.quelle,
            updErr.message,
          );
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
        } else if (e.quelle === "vorjahr") {
          ergebnis.via_vorjahr++;
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

    ergebnis.zeitlimit_erreicht = zeitlimitErreicht;

    // PROJ-15 (Konsistenz-Pro) — Phase 2: Konsistenz-Pass laeuft NACH der
    // Hauptschleife im selben Job. Er gleicht haeufig vorkommende Empfaenger
    // mit Mehrfach-Kategorien auf die Mehrheits-Kategorie an, sofern die
    // Mehrheit mindestens 60% mit >=0.85 Durchschnitts-Konfidenz hat und
    // die Klassifikation einheitlich ist. Manuell bestaetigte Buchungen
    // werden niemals angefasst.
    // Bei Zeitlimit-Abbruch wird er ÜBERSPRUNGEN — er soll erst auf dem
    // vollständig klassifizierten Datenstand laufen (und es fehlt ohnehin Zeit).
    // PROJ-15 P2 (#1): Bei einer gezielten Auswahl (buchung_ids) wird der
    // Konsistenz-Pass ebenfalls übersprungen — er gleicht owner-weit ab und
    // wäre für eine punktuelle Re-Klassifizierung weniger Buchungen ein
    // überraschender Seiteneffekt.
    try {
      ergebnis.konsistenz_pass =
        zeitlimitErreicht || explizitIds
          ? null
          : await wendeKonsistenzPassAn(supabase, user.id);
    } catch {
      // Pass ist best-effort: Fehler darf den Lauf nicht als 'fehler'
      // markieren, die Hauptphase ist erfolgreich fertig.
      ergebnis.konsistenz_pass = null;
    }

    // Auch ein zeitlimitierter Lauf endet sauber als 'fertig' (Teil-Erfolg);
    // fortschritt spiegelt die tatsächlich verarbeitete Anzahl.
    const verarbeitetGesamt = buchungen.length - (ergebnis.verbleibend ?? 0);
    await supabase
      .from("job_lauf")
      .update({
        status: "fertig",
        fortschritt: verarbeitetGesamt,
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
