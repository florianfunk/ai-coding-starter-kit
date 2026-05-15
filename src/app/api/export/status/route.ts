// PROJ-11: Leichter Abschluss-Status für die Export-Auswahl.
//
// GET ?art=ust_va|wirtschaftsjahr&jahr=YYYY[&periode=N] -> { abgeschlossen }
//
// Dient nur der UI-Warnung („vorläufig"), nicht der Datengenerierung. Auth
// Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS. Zod VOR DB.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const statusQuerySchema = z
  .object({
    art: z.enum(["ust_va", "wirtschaftsjahr"]),
    jahr: z.coerce.number().int().min(2000).max(2100),
    periode: z.coerce.number().int().min(0).max(12).optional(),
  })
  .refine((d) => (d.art === "ust_va" ? d.periode !== undefined : true), {
    path: ["periode"],
    message: "Periode für USt-VA erforderlich.",
  });

export async function GET(request: Request): Promise<NextResponse> {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = statusQuerySchema.safeParse({
    art: url.searchParams.get("art"),
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
  const { art, jahr, periode } = parsed.data;
  const supabase = await createClient();

  let query = supabase
    .from("steuerperiode")
    .select("status")
    .eq("owner_id", user.id)
    .eq("art", art)
    .eq("jahr", jahr)
    .limit(1);
  query =
    art === "ust_va"
      ? query.eq("periode", periode as number)
      : query.is("periode", null);

  const { data } = await query.maybeSingle();
  const abgeschlossen =
    data != null && (data as { status: string }).status === "abgeschlossen";

  return NextResponse.json({ abgeschlossen });
}
