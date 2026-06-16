// PROJ-18 — Bulk-USt-Satz. Setzt `ust_satz` (0 | 7 | 19 | null) für viele
// Buchungen + `status` = 'manuell_bestaetigt', damit die Re-Klassifizierung
// das nicht überschreibt. `kategorie_id` und `klassifikation` bleiben
// unverändert — der Inhaber korrigiert hier gezielt nur den Steuersatz.
//
// Auth: getApiUser. RLS deckt zusätzlich ab.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { bulkUstSchema } from "@/lib/validation/buchungen-ust-bulk";
import { ladeNachBloecken } from "@/lib/supabase/fetch-all";
import type { BuchungStatus } from "@/lib/types";

interface BuchungVorher {
  id: string;
  ust_satz: number | null;
  status: BuchungStatus;
}

export interface BulkUstResponse {
  aktualisiert: number;
  uebersprungen: string[];
  ust_satz: number | null;
}

export async function POST(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body." },
      { status: 400 },
    );
  }
  const parsed = bulkUstSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validierung fehlgeschlagen" },
      { status: 422 },
    );
  }
  const { ids, ust_satz } = parsed.data;
  const supabase = await createClient();

  const { data: vorherData, error: vorherErr } = await ladeNachBloecken(
    ids,
    (block) =>
      supabase
        .from("buchung")
        .select("id, ust_satz, status")
        .eq("owner_id", user.id)
        .in("id", block),
  );
  if (vorherErr) {
    return NextResponse.json(
      { error: "Vorher-Snapshot fehlgeschlagen: " + vorherErr.message },
      { status: 500 },
    );
  }
  const vorher = (vorherData ?? []) as BuchungVorher[];
  const gefunden = new Set(vorher.map((b) => b.id));
  const uebersprungen = ids.filter((id) => !gefunden.has(id));

  if (vorher.length === 0) {
    return NextResponse.json({
      aktualisiert: 0,
      uebersprungen,
      ust_satz,
    } satisfies BulkUstResponse);
  }

  const updates: Record<string, unknown> = {
    ust_satz,
    status: "manuell_bestaetigt",
    quelle: "manuell",
    pruef_grund: null,
  };

  const { data: nachherData, error: updErr } = await ladeNachBloecken(
    Array.from(gefunden),
    (block) =>
      supabase
        .from("buchung")
        .update(updates)
        .eq("owner_id", user.id)
        .in("id", block)
        .select("id, ust_satz, status"),
  );
  if (updErr) {
    return NextResponse.json(
      { error: "Bulk-Update fehlgeschlagen: " + updErr.message },
      { status: 500 },
    );
  }
  const nachher = (nachherData ?? []) as BuchungVorher[];
  const nachherMap = new Map(nachher.map((b) => [b.id, b]));

  const auditRows = vorher.map((v) => ({
    owner_id: user.id,
    entitaet: "buchung",
    entitaet_id: v.id,
    aktion: "bulk_ust_gesetzt",
    quelle: "nutzer",
    details: {
      vorher: v,
      nachher: nachherMap.get(v.id) ?? null,
      ust_satz,
      bulk_size: vorher.length,
    },
  }));
  await supabase.from("audit_eintrag").insert(auditRows);

  const payload: BulkUstResponse = {
    aktualisiert: nachher.length,
    uebersprungen,
    ust_satz,
  };
  return NextResponse.json(payload);
}
