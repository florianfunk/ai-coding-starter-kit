// PROJ-18 — Bulk-Klassifikation. Setzt `klassifikation` (privat |
// geschaeftlich) für viele Buchungen + setzt `status` auf
// 'manuell_bestaetigt', damit die Re-Klassifizierung das nicht
// überschreibt. `kategorie_id` und `ust_satz` werden NICHT verändert
// — der Inhaber kann die Kategorie weiterhin frei wählen.
//
// Auth: getApiUser. RLS deckt zusätzlich ab.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { bulkKlassifikationSchema } from "@/lib/validation/buchungen-klassifikation-bulk";
import type { BuchungStatus, Klassifikation } from "@/lib/types";

interface BuchungVorher {
  id: string;
  klassifikation: Klassifikation | null;
  status: BuchungStatus;
}

export interface BulkKlassifikationResponse {
  aktualisiert: number;
  uebersprungen: string[];
  klassifikation: "privat" | "geschaeftlich";
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
  const parsed = bulkKlassifikationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Validierung fehlgeschlagen",
      },
      { status: 422 },
    );
  }
  const { ids, klassifikation } = parsed.data;
  const supabase = await createClient();

  const { data: vorherData, error: vorherErr } = await supabase
    .from("buchung")
    .select("id, klassifikation, status")
    .eq("owner_id", user.id)
    .in("id", ids);
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
      klassifikation,
    } satisfies BulkKlassifikationResponse);
  }

  const updates: Record<string, unknown> = {
    klassifikation,
    status: "manuell_bestaetigt",
    quelle: "manuell",
    pruef_grund: null,
  };

  const { data: nachherData, error: updErr } = await supabase
    .from("buchung")
    .update(updates)
    .eq("owner_id", user.id)
    .in("id", Array.from(gefunden))
    .select("id, klassifikation, status");
  if (updErr) {
    return NextResponse.json(
      { error: "Bulk-Update fehlgeschlagen: " + updErr.message },
      { status: 500 },
    );
  }
  const nachher = (nachherData ?? []) as BuchungVorher[];
  const nachherMap = new Map(nachher.map((b) => [b.id, b]));

  // Audit-Spur — einer pro Buchung, in einem INSERT.
  const auditRows = vorher.map((v) => ({
    owner_id: user.id,
    entitaet: "buchung",
    entitaet_id: v.id,
    aktion: "bulk_klassifikation_gesetzt",
    quelle: "nutzer",
    details: {
      vorher: v,
      nachher: nachherMap.get(v.id) ?? null,
      klassifikation,
      bulk_size: vorher.length,
    },
  }));
  await supabase.from("audit_eintrag").insert(auditRows);

  const payload: BulkKlassifikationResponse = {
    aktualisiert: nachher.length,
    uebersprungen,
    klassifikation,
  };
  return NextResponse.json(payload);
}
