// Empfaenger-Kuendigungsliste — API.
//
// GET  → Liste aller markierten Empfaenger mit aggregierten Buchungs-
//        Statistiken (Anzahl, durchschnittlicher Betrag, geschaetzte
//        Jahresbelastung, letzte Buchung, Intervall).
// POST → Empfaenger zur Liste hinzufuegen. Idempotent: ist er bereits
//        drauf, wird nur der Status zurueckgegeben.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { normalisiereEmpfaenger } from "@/lib/classifier/normalize";
import { ladeAlle } from "@/lib/supabase/fetch-all";
import { aktiverZeitraum } from "@/lib/jahr/aktives-jahr";

export type KuendigungStatus = "offen" | "gekuendigt" | "beendet";

export interface KuendigungZeile {
  empfaenger_norm: string;
  empfaenger_anzeige: string;
  status: KuendigungStatus;
  notiz: string | null;
  markiert_am: string;
  /** Aggregat ueber alle Buchungen des Empfaengers. */
  statistik: {
    anzahl: number;
    /** Mittlerer Absolut-Betrag. */
    durchschnitt: number;
    /** Geschaetzte Jahresbelastung (auf Basis Median-Intervall in Tagen). */
    jahresbelastung: number;
    /** Median-Intervall in Tagen zwischen den Buchungen. NULL wenn < 2. */
    intervall_tage: number | null;
    /** ISO-Datum der letzten Buchung. */
    letzte: string | null;
  };
}

export interface KuendigungenListeResponse {
  data: KuendigungZeile[];
}

const postSchema = z.object({
  empfaenger: z
    .string()
    .trim()
    .min(2, "Empfaenger muss mindestens 2 Zeichen haben")
    .max(200),
  notiz: z.string().trim().max(2000).optional(),
});

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: markierungen, error: kerr } = await supabase
    .from("empfaenger_kuendigung")
    .select("empfaenger_norm, rohwert_beispiel, status, notiz, markiert_am")
    .eq("owner_id", user.id)
    .order("status", { ascending: true })
    .order("markiert_am", { ascending: false })
    .limit(500);
  if (kerr) {
    return NextResponse.json(
      { error: "Kuendigungs-Liste konnte nicht geladen werden." },
      { status: 500 },
    );
  }
  const markierungenSafe = (markierungen ?? []) as Array<{
    empfaenger_norm: string;
    rohwert_beispiel: string | null;
    status: KuendigungStatus;
    notiz: string | null;
    markiert_am: string;
  }>;

  if (markierungenSafe.length === 0) {
    return NextResponse.json({ data: [] } satisfies KuendigungenListeResponse);
  }

  // Buchungen aller markierten Empfaenger holen (auf einmal — wir wollen
  // pro Empfaenger eine Statistik bilden).
  const normWerte = markierungenSafe.map((m) => m.empfaenger_norm);

  // PROJ-22: Buchungen der markierten Empfaenger aufs global aktive Jahr scopen.
  const { von, bis } = await aktiverZeitraum(supabase, user.id, {});

  // Vollständig paginiert laden — PostgREST deckelt sonst bei 1000 Zeilen und
  // schnitte (asc-Sortierung) neuere Buchungen ab. Stabile Sortierung via id.
  const { data: buchungenData } = await ladeAlle((vonIdx, bisIdx) => {
    let q = supabase
      .from("buchung")
      .select("empfaenger_normalisiert, empfaenger, buchung_datum, betrag")
      .eq("owner_id", user.id)
      .in("empfaenger_normalisiert", normWerte)
      .order("buchung_datum", { ascending: true })
      .order("id", { ascending: true })
      .range(vonIdx, bisIdx);
    if (von) q = q.gte("buchung_datum", von);
    if (bis) q = q.lte("buchung_datum", bis);
    return q;
  });
  const buchungen = (buchungenData ?? []) as Array<{
    empfaenger_normalisiert: string | null;
    empfaenger: string | null;
    buchung_datum: string;
    betrag: number;
  }>;

  // Gruppierung pro empfaenger_norm.
  const gruppen = new Map<
    string,
    {
      buchungen: typeof buchungen;
      anzeige: string;
    }
  >();
  for (const b of buchungen) {
    const k = b.empfaenger_normalisiert ?? "";
    let g = gruppen.get(k);
    if (!g) {
      g = { buchungen: [], anzeige: b.empfaenger?.trim() || k };
      gruppen.set(k, g);
    }
    g.buchungen.push(b);
  }

  const data: KuendigungZeile[] = markierungenSafe.map((m) => {
    const g = gruppen.get(m.empfaenger_norm);
    const anzeige =
      g?.anzeige ?? m.rohwert_beispiel ?? m.empfaenger_norm;
    const stat = g ? berechneStatistik(g.buchungen) : {
      anzahl: 0,
      durchschnitt: 0,
      jahresbelastung: 0,
      intervall_tage: null as number | null,
      letzte: null as string | null,
    };
    return {
      empfaenger_norm: m.empfaenger_norm,
      empfaenger_anzeige: anzeige,
      status: m.status,
      notiz: m.notiz,
      markiert_am: m.markiert_am,
      statistik: stat,
    };
  });

  return NextResponse.json({ data } satisfies KuendigungenListeResponse);
}

function berechneStatistik(
  buchungen: Array<{ buchung_datum: string; betrag: number }>,
): KuendigungZeile["statistik"] {
  const anzahl = buchungen.length;
  if (anzahl === 0) {
    return {
      anzahl: 0,
      durchschnitt: 0,
      jahresbelastung: 0,
      intervall_tage: null,
      letzte: null,
    };
  }
  const betraegeAbs = buchungen.map((b) => Math.abs(b.betrag));
  const durchschnitt =
    betraegeAbs.reduce((s, v) => s + v, 0) / betraegeAbs.length;

  // Median-Intervall
  let intervallTage: number | null = null;
  if (anzahl >= 2) {
    const sortiert = buchungen
      .slice()
      .sort((a, b) => a.buchung_datum.localeCompare(b.buchung_datum));
    const deltas: number[] = [];
    for (let i = 1; i < sortiert.length; i++) {
      const a = new Date(sortiert[i - 1].buchung_datum).getTime();
      const b = new Date(sortiert[i].buchung_datum).getTime();
      const tage = Math.round((b - a) / 86400000);
      if (tage > 0) deltas.push(tage);
    }
    if (deltas.length > 0) {
      deltas.sort((a, b) => a - b);
      const mid = Math.floor(deltas.length / 2);
      intervallTage =
        deltas.length % 2 === 0
          ? Math.round((deltas[mid - 1] + deltas[mid]) / 2)
          : deltas[mid];
    }
  }

  // Jahresbelastung: durchschnitt * (365 / intervall_tage), wenn vorhanden.
  // Sonst einfach die Summe (Einmal-Ausgabe).
  const jahresbelastung =
    intervallTage && intervallTage > 0
      ? Math.round((durchschnitt * 365) / intervallTage * 100) / 100
      : Math.round(betraegeAbs.reduce((s, v) => s + v, 0) * 100) / 100;

  const letzte = buchungen[buchungen.length - 1]?.buchung_datum ?? null;

  return {
    anzahl,
    durchschnitt: Math.round(durchschnitt * 100) / 100,
    jahresbelastung,
    intervall_tage: intervallTage,
    letzte,
  };
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
      { error: "Ungueltiger Request-Body." },
      { status: 400 },
    );
  }
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Validierung fehlgeschlagen" },
      { status: 422 },
    );
  }
  const rohwert = parsed.data.empfaenger;
  const norm = normalisiereEmpfaenger(rohwert);
  if (!norm || norm.length < 2) {
    return NextResponse.json(
      { error: "Empfaenger ergibt keinen gueltigen Schluessel." },
      { status: 422 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empfaenger_kuendigung")
    .upsert(
      {
        owner_id: user.id,
        empfaenger_norm: norm,
        rohwert_beispiel: rohwert,
        notiz: parsed.data.notiz ?? null,
      },
      { onConflict: "owner_id,empfaenger_norm", ignoreDuplicates: false },
    )
    .select("empfaenger_norm, status, notiz, markiert_am")
    .single();
  if (error) {
    return NextResponse.json(
      { error: "Markierung fehlgeschlagen: " + error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ data }, { status: 201 });
}
