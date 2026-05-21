// PROJ-16: "Mein Profil" — persönliche Stammdaten als LLM-Kontext.
//
// Server-Component. Wir laden das Profil sowie die komplette Konten-Liste
// direkt via Supabase (kein fetch-Roundtrip im SSR), damit das initial-Render
// keinen API-Hop braucht. Die einzelnen Karten sind Client-Components und
// rufen ihre Mutations-APIs selbst auf.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { ArbeitgeberKarte } from "@/components/profil/arbeitgeber-karte";
import { AdresseKarte } from "@/components/profil/adresse-karte";
import { FamilieKarte } from "@/components/profil/familie-karte";
import { KontenKarte } from "@/components/profil/konten-karte";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mein Profil · STEUERAGENT",
};

interface KontoRow {
  id: string;
  bezeichnung: string;
  ist_eigenes_konto: boolean;
  mapping: { iban?: string | null } | null;
}

export default async function ProfilPage() {
  const user = await requireUser();
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
    supabase
      .from("konto")
      .select("id, bezeichnung, ist_eigenes_konto, mapping")
      .eq("owner_id", user.id)
      .order("bezeichnung", { ascending: true })
      .limit(100),
  ]);

  const konten = ((kontoRes.data ?? []) as KontoRow[]).map((k) => ({
    id: k.id,
    bezeichnung: k.bezeichnung,
    ist_eigenes_konto: k.ist_eigenes_konto,
    iban:
      typeof k.mapping?.iban === "string" && k.mapping.iban.length > 0
        ? k.mapping.iban
        : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mein Profil</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Persönliche Stammdaten, die der Agent bei der Klassifizierung nutzt.
          Arbeitgeber, Wohnort, Familienmitglieder und eigene Bankkonten
          helfen der Pipeline, Privat-Buchungen sauber von geschäftlichen zu
          trennen.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ArbeitgeberKarte initial={arbRes.data ?? []} />
        <AdresseKarte initial={adrRes.data ?? null} />
        <FamilieKarte initial={famRes.data ?? []} />
        <KontenKarte initial={konten} />
      </div>
    </div>
  );
}
