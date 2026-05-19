// PROJ-13: Aggregierter System-Status (owner-scoped).
// GET -> Supabase erreichbar, Paperless konfiguriert, KI konfiguriert,
//        ESt-Tarif-Jahre, letzte Jobs je Art. Keine Secrets im Klartext.
// Auth Pflicht (getApiUser). RLS ist zweite Verteidigungslinie.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { ladeAiKey } from "@/lib/admin/ai-key";
import type { JobArt, JobLauf } from "@/lib/types";

const JOB_ARTEN: JobArt[] = [
  "paperless_sync",
  "konto_import",
  "klassifizierung",
];

const JOB_FELDER =
  "id, art, status, fortschritt, gesamt, ergebnis, fehler_text, created_at";

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const supabase = await createClient();

  // Supabase-Erreichbarkeit über eine leichte owner-scoped Query prüfen.
  const { error: pingError } = await supabase
    .from("app_einstellung")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  const supabaseOk = !pingError;

  // Paperless: Verbindung vorhanden + Token gesetzt?
  const { data: verb } = await supabase
    .from("paperless_verbindung")
    .select("token_cipher")
    .eq("owner_id", user.id)
    .maybeSingle();
  const paperlessKonfiguriert =
    ((verb as { token_cipher: string | null } | null)?.token_cipher ?? "")
      .trim().length > 0;

  // KI: zentrale Auflösung (DB vor Env).
  const aiKey = await ladeAiKey();
  const kiKonfiguriert = aiKey.key !== null;

  // ESt-Tarif-Jahre.
  const { data: tarife } = await supabase
    .from("est_tarif")
    .select("jahr")
    .eq("owner_id", user.id)
    .order("jahr", { ascending: true })
    .limit(50);
  const estTarife = (tarife ?? []).map(
    (t) => (t as { jahr: number }).jahr,
  );

  // Letzter Job je Art (created_at desc, je 1).
  const letzteJobs: Record<string, JobLauf | null> = {};
  for (const art of JOB_ARTEN) {
    const { data: jobRow } = await supabase
      .from("job_lauf")
      .select(JOB_FELDER)
      .eq("owner_id", user.id)
      .eq("art", art)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    letzteJobs[art] = (jobRow as JobLauf | null) ?? null;
  }

  return NextResponse.json({
    supabase_ok: supabaseOk,
    paperless_konfiguriert: paperlessKonfiguriert,
    ki_konfiguriert: kiKonfiguriert,
    ki_quelle: aiKey.quelle,
    ki_model: aiKey.model,
    est_tarife: estTarife,
    letzte_jobs: letzteJobs,
  });
}
