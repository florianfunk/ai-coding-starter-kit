import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 1) {
    return NextResponse.json({ bereiche: [], kategorien: [], produkte: [] });
  }

  const supabase = await createClient();
  const pattern = `%${q}%`;

  const [bereicheRes, kategorienRes, produkteRes] = await Promise.all([
    supabase
      .from("bereiche")
      .select("id, name")
      .ilike("name", pattern)
      .limit(3),
    supabase
      .from("kategorien")
      .select("id, name")
      .ilike("name", pattern)
      .limit(3),
    supabase
      .from("produkte")
      .select("id, artikelnummer, name")
      .or(`artikelnummer.ilike.${pattern},name.ilike.${pattern}`)
      .limit(5),
  ]);

  return NextResponse.json({
    bereiche: bereicheRes.data ?? [],
    kategorien: kategorienRes.data ?? [],
    produkte: produkteRes.data ?? [],
  });
}
