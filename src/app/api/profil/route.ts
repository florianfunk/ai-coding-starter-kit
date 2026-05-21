// PROJ-16: "Mein Profil" — aggregierter GET-Endpunkt.
//
// Liefert in EINEM Aufruf alles, was die Profil-UI braucht:
//   - arbeitgeber (Liste)
//   - familie    (Liste)
//   - adresse    (Single-Row oder null)
//   - eigene_konten (alle Konten des Owners mit ist_eigenes_konto=true,
//                    Felder {id, bezeichnung, iban})
//
// Auth Pflicht (getApiUser). RLS deckt die Tabellen zusaetzlich ab.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";

interface KontoRow {
  id: string;
  bezeichnung: string;
  ist_eigenes_konto: boolean;
  mapping: { iban?: string | null } | null;
}

/** GET /api/profil — gesamtes Profil + alle Konten (zum Toggle "eigenes Konto"). */
export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const supabase = await createClient();

  const [arbRes, famRes, adrRes, kontoRes] = await Promise.all([
    supabase
      .from("mein_profil_arbeitgeber")
      .select(
        "id, name, name_normalisiert, aktiv_von, aktiv_bis, notiz, updated_at",
      )
      .eq("owner_id", user.id)
      .order("name", { ascending: true })
      .limit(100),
    supabase
      .from("mein_profil_familie")
      .select(
        "id, name, name_normalisiert, rolle, auch_geschaeftspartner, notiz, updated_at",
      )
      .eq("owner_id", user.id)
      .order("name", { ascending: true })
      .limit(100),
    supabase
      .from("mein_profil_adresse")
      .select("strasse, plz, ort, land, updated_at")
      .eq("owner_id", user.id)
      .maybeSingle(),
    // ALLE Konten des Owners — die UI braucht beide Buckets (eigen / fremd)
    // fuer den Toggle-Schalter "ist_eigenes_konto".
    supabase
      .from("konto")
      .select("id, bezeichnung, ist_eigenes_konto, mapping")
      .eq("owner_id", user.id)
      .order("bezeichnung", { ascending: true })
      .limit(100),
  ]);

  if (arbRes.error || famRes.error || kontoRes.error) {
    return NextResponse.json(
      { error: "Profil konnte nicht vollstaendig geladen werden." },
      { status: 500 },
    );
  }

  const konten = ((kontoRes.data ?? []) as KontoRow[]).map((k) => ({
    id: k.id,
    bezeichnung: k.bezeichnung,
    ist_eigenes_konto: k.ist_eigenes_konto,
    iban:
      typeof k.mapping?.iban === "string" && k.mapping.iban.length > 0
        ? k.mapping.iban
        : null,
  }));

  return NextResponse.json({
    arbeitgeber: arbRes.data ?? [],
    familie: famRes.data ?? [],
    adresse: adrRes.data ?? null,
    konten,
  });
}
