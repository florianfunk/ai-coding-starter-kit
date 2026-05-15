// PROJ-3: Paperless-Sync.
// POST -> startet einen Sync (synchron, MVP), legt job_lauf (art=paperless_sync)
//         an, importiert Belege idempotent (upsert auf owner_id+paperless_id),
//         pflegt Fortschritt/Zähler/Fehlerliste, markiert in Quelle entfernte
//         Belege. Fehler einzelner Dokumente brechen den Lauf NICHT ab.
// GET  -> letzter/aktueller Sync-Status (job_lauf).
// Auth Pflicht (getApiUser). Owner-scoped zusätzlich zur RLS.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { decrypt } from "@/lib/crypto";
import { paperlessSyncFilterSchema } from "@/lib/validation/paperless";
import {
  PaperlessError,
  fetchLookups,
  iterateDocuments,
  mapDocumentToBeleg,
  type PaperlessFilter,
} from "@/lib/paperless/client";

interface SyncErgebnis {
  neu: number;
  aktualisiert: number;
  unveraendert: number;
  unvollstaendig: number;
  quelle_entfernt: number;
  fehler: Array<{ paperless_id: number | null; grund: string }>;
}

const SELECT_JOB =
  "id, art, status, fortschritt, gesamt, ergebnis, fehler_text, created_at";

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
    .eq("art", "paperless_sync")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Sync-Status konnte nicht geladen werden." },
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

  // Optionaler Filter im Body.
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

  const parsedFilter = paperlessSyncFilterSchema.safeParse(body ?? {});
  if (!parsedFilter.success) {
    const erstes = parsedFilter.error.issues[0];
    return NextResponse.json(
      {
        error: erstes
          ? `${erstes.path.join(".") || "Filter"}: ${erstes.message}`
          : "Validierung fehlgeschlagen.",
      },
      { status: 422 },
    );
  }
  const filter: PaperlessFilter = parsedFilter.data;

  const supabase = await createClient();

  // Schon ein laufender Sync? Dann blockieren (Doppelstart vermeiden).
  const { data: laufend } = await supabase
    .from("job_lauf")
    .select("id, status")
    .eq("owner_id", user.id)
    .eq("art", "paperless_sync")
    .eq("status", "laeuft")
    .limit(1)
    .maybeSingle();

  if (laufend) {
    return NextResponse.json(
      { error: "Es läuft bereits ein Sync. Bitte warte, bis er fertig ist." },
      { status: 409 },
    );
  }

  // Verbindung laden + Token entschlüsseln.
  const { data: verb, error: verbError } = await supabase
    .from("paperless_verbindung")
    .select("base_url, token_cipher")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (verbError) {
    return NextResponse.json(
      { error: "Verbindung konnte nicht geladen werden." },
      { status: 500 },
    );
  }
  const verbindung = verb as
    | { base_url: string; token_cipher: string }
    | null;
  if (!verbindung) {
    return NextResponse.json(
      { error: "Keine Paperless-Verbindung gespeichert. Bitte zuerst einrichten." },
      { status: 400 },
    );
  }

  let token: string;
  try {
    token = decrypt(verbindung.token_cipher);
  } catch {
    return NextResponse.json(
      {
        error:
          "Token konnte nicht entschlüsselt werden. Bitte Token erneut speichern.",
      },
      { status: 500 },
    );
  }

  // job_lauf anlegen (Status laeuft).
  const { data: jobRow, error: jobError } = await supabase
    .from("job_lauf")
    .insert({
      owner_id: user.id,
      art: "paperless_sync",
      status: "laeuft",
      fortschritt: 0,
    })
    .select("id")
    .single();

  if (jobError || !jobRow) {
    return NextResponse.json(
      { error: "Sync-Job konnte nicht angelegt werden." },
      { status: 500 },
    );
  }
  const jobId = (jobRow as { id: string }).id;

  const ergebnis: SyncErgebnis = {
    neu: 0,
    aktualisiert: 0,
    unveraendert: 0,
    unvollstaendig: 0,
    quelle_entfernt: 0,
    fehler: [],
  };
  const gesehenePaperlessIds = new Set<number>();

  try {
    const lookups = await fetchLookups(verbindung.base_url, token);

    for await (const seite of iterateDocuments(
      verbindung.base_url,
      token,
      filter,
    )) {
      for (const doc of seite) {
        try {
          const beleg = mapDocumentToBeleg(
            doc,
            lookups,
            verbindung.base_url,
          );
          gesehenePaperlessIds.add(beleg.paperless_id);

          // Vorhandenen Beleg laden (Idempotenz + Änderungserkennung).
          const { data: vorhanden } = await supabase
            .from("beleg")
            .select("id, inhalt_hash")
            .eq("owner_id", user.id)
            .eq("paperless_id", beleg.paperless_id)
            .maybeSingle();

          const istVorhanden = vorhanden as
            | { id: string; inhalt_hash: string | null }
            | null;

          if (istVorhanden && istVorhanden.inhalt_hash === beleg.inhalt_hash) {
            ergebnis.unveraendert++;
            if (beleg.status === "unvollstaendig") ergebnis.unvollstaendig++;
            continue;
          }

          const { error: upsertError } = await supabase
            .from("beleg")
            .upsert(
              {
                owner_id: user.id,
                paperless_id: beleg.paperless_id,
                titel: beleg.titel,
                beleg_datum: beleg.beleg_datum,
                korrespondent: beleg.korrespondent,
                betrag: beleg.betrag,
                tags: beleg.tags,
                dokumenttyp: beleg.dokumenttyp,
                ocr_text: beleg.ocr_text,
                quell_link: beleg.quell_link,
                inhalt_hash: beleg.inhalt_hash,
                status: beleg.status,
              },
              { onConflict: "owner_id,paperless_id" },
            );

          if (upsertError) {
            ergebnis.fehler.push({
              paperless_id: beleg.paperless_id,
              grund: "Beleg konnte nicht gespeichert werden.",
            });
            continue;
          }

          if (istVorhanden) ergebnis.aktualisiert++;
          else ergebnis.neu++;
          if (beleg.status === "unvollstaendig") ergebnis.unvollstaendig++;
        } catch (docErr) {
          // Einzeldokument-Fehler bricht den Gesamt-Sync nicht ab.
          ergebnis.fehler.push({
            paperless_id: typeof doc?.id === "number" ? doc.id : null,
            grund:
              docErr instanceof Error
                ? docErr.message
                : "Unbekannter Fehler bei Dokument.",
          });
        }
      }

      // Fortschritt fortlaufend pflegen.
      await supabase
        .from("job_lauf")
        .update({
          fortschritt:
            ergebnis.neu +
            ergebnis.aktualisiert +
            ergebnis.unveraendert,
        })
        .eq("id", jobId)
        .eq("owner_id", user.id);
    }

    // In Quelle entfernte Belege markieren (nur ohne Filter, sonst False-Positives).
    const ohneFilter =
      !filter.von && !filter.bis && !filter.tag && !filter.korrespondent;
    if (ohneFilter && gesehenePaperlessIds.size > 0) {
      const { data: alle } = await supabase
        .from("beleg")
        .select("id, paperless_id, status")
        .eq("owner_id", user.id)
        .neq("status", "quelle_entfernt")
        .limit(50000);

      const verwaiste = (
        (alle as
          | { id: string; paperless_id: number; status: string }[]
          | null) ?? []
      ).filter((b) => !gesehenePaperlessIds.has(b.paperless_id));

      for (const w of verwaiste) {
        const { error: markErr } = await supabase
          .from("beleg")
          .update({ status: "quelle_entfernt" })
          .eq("id", w.id)
          .eq("owner_id", user.id);
        if (!markErr) ergebnis.quelle_entfernt++;
      }
    }

    await supabase
      .from("job_lauf")
      .update({
        status: "fertig",
        fortschritt:
          ergebnis.neu + ergebnis.aktualisiert + ergebnis.unveraendert,
        gesamt:
          ergebnis.neu + ergebnis.aktualisiert + ergebnis.unveraendert,
        ergebnis: ergebnis as unknown as Record<string, unknown>,
      })
      .eq("id", jobId)
      .eq("owner_id", user.id);

    await supabase
      .from("paperless_verbindung")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("owner_id", user.id);

    return NextResponse.json({ ok: true, job_id: jobId, ergebnis });
  } catch (err) {
    const fehlerText =
      err instanceof PaperlessError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unbekannter Fehler beim Sync.";

    // Teil-Ergebnis NICHT verwerfen (bereits importierte Belege bleiben).
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
      { status: 502 },
    );
  }
}
