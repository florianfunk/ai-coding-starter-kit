// PROJ-5: Read-only Audit-Trail einer Entität (für Detail-Sheet).
// GET /api/audit?entitaet=buchung&entitaet_id=<uuid>
// Auth Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  entitaet: z.enum(["buchung"]),
  entitaet_id: z.uuid("Ungültige Entitäts-ID"),
});

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    entitaet: url.searchParams.get("entitaet"),
    entitaet_id: url.searchParams.get("entitaet_id"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ungültige Parameter." },
      { status: 422 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_eintrag")
    .select("id, aktion, quelle, details, created_at")
    .eq("owner_id", user.id)
    .eq("entitaet", parsed.data.entitaet)
    .eq("entitaet_id", parsed.data.entitaet_id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: "Audit-Einträge konnten nicht geladen werden." },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: data ?? [] });
}
