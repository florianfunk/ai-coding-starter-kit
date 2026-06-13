// Import-Historie: Liste aller Konto-Import-Laeufe des Eigentuemers.
//
// Liefert pro Lauf die Datei-Metadaten, das Konto, das Ergebnis-Protokoll
// und — wichtig fuer den Undo-Button — die aktuelle Anzahl noch
// vorhandener Buchungen aus diesem Lauf. Das ist nicht zwingend gleich der
// urspruenglich importierten Zahl (z. B. wenn Splits dazukamen oder
// einzelne Buchungen geloescht wurden).

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";

export interface ImportLaufZeile {
  id: string;
  created_at: string;
  status: "laeuft" | "fertig" | "fehler";
  dateiname: string | null;
  dateigroesse: number | null;
  konto: { id: string; bezeichnung: string; typ: string } | null;
  protokoll: {
    importiert: number;
    uebersprungen: number;
    fehlerhaft: number;
  } | null;
  fehler_text: string | null;
  /** Anzahl Buchungen, die JETZT noch zu diesem Lauf gehoeren. */
  buchungen_aktuell: number;
}

export interface ImporteListeResponse {
  data: ImportLaufZeile[];
}

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: laeufeData, error } = await supabase
    .from("job_lauf")
    .select(
      "id, created_at, status, dateiname, dateigroesse, ergebnis, fehler_text, konto_id",
    )
    .eq("owner_id", user.id)
    .eq("art", "konto_import")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: "Import-Historie konnte nicht geladen werden." },
      { status: 500 },
    );
  }

  const laeufe = (laeufeData ?? []) as Array<{
    id: string;
    created_at: string;
    status: "laeuft" | "fertig" | "fehler";
    dateiname: string | null;
    dateigroesse: number | null;
    ergebnis: Record<string, unknown> | null;
    fehler_text: string | null;
    konto_id: string | null;
  }>;

  // Konten in einem Schwung holen (statt embedded select, das mit Supabase-
  // JS' Typ-Inferenz ein Array statt eines Objekts liefert).
  const kontoIds = Array.from(
    new Set(laeufe.map((l) => l.konto_id).filter((x): x is string => !!x)),
  );
  const kontoMap = new Map<
    string,
    { id: string; bezeichnung: string; typ: string }
  >();
  if (kontoIds.length > 0) {
    const { data: kontenData } = await supabase
      .from("konto")
      .select("id, bezeichnung, typ")
      .eq("owner_id", user.id)
      .in("id", kontoIds);
    for (const k of (kontenData ?? []) as Array<{
      id: string;
      bezeichnung: string;
      typ: string;
    }>) {
      kontoMap.set(k.id, k);
    }
  }

  // Buchungs-Counts pro Lauf in einem Schwung — ueber RPC waere noch
  // effizienter, aber owner-scoped reicht ein zweites Select.
  const counts = new Map<string, number>();
  if (laeufe.length > 0) {
    const ids = laeufe.map((l) => l.id);
    const { data: gruppen } = await supabase
      .from("buchung")
      .select("import_lauf_id")
      .eq("owner_id", user.id)
      .in("import_lauf_id", ids);
    for (const row of (gruppen ?? []) as Array<{ import_lauf_id: string }>) {
      counts.set(row.import_lauf_id, (counts.get(row.import_lauf_id) ?? 0) + 1);
    }
  }

  const data: ImportLaufZeile[] = laeufe.map((l) => {
    const proto = (l.ergebnis ?? null) as
      | { importiert?: number; uebersprungen?: number; fehlerhaft?: number }
      | null;
    return {
      id: l.id,
      created_at: l.created_at,
      status: l.status,
      dateiname: l.dateiname,
      dateigroesse: l.dateigroesse,
      konto: l.konto_id ? (kontoMap.get(l.konto_id) ?? null) : null,
      protokoll: proto
        ? {
            importiert: proto.importiert ?? 0,
            uebersprungen: proto.uebersprungen ?? 0,
            fehlerhaft: proto.fehlerhaft ?? 0,
          }
        : null,
      fehler_text: l.fehler_text,
      buchungen_aktuell: counts.get(l.id) ?? 0,
    };
  });

  return NextResponse.json({ data } satisfies ImporteListeResponse);
}
