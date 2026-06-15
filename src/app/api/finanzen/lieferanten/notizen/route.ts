// PROJ-21 — Lieferanten-Notizen: Liste & Anlegen.
//
// GET  → drei Modi:
//   (ohne Parameter)   alle Notizen des Owners, gruppiert je Lieferant
//                      (für die Übersichtsseite). Anzeigenamen werden aus
//                      den Buchungen abgeleitet (häufigste Roh-Schreibweise).
//   ?norm=<norm>       nur die Notizen eines Lieferanten (Drilldown, flach).
//   ?buchung_id=<id>   löst den empfaenger_normalisiert der Buchung auf und
//                      liefert dessen Notizen (read-only-Block im Buchungs-
//                      Detail; gleiche Mechanik wie /api/empfaenger-kenntnis).
//
// POST → neue Notiz anlegen. Body { empfaenger, inhalt }. Der Empfänger wird
//        serverseitig normalisiert. Audit-Eintrag mit quelle="nutzer".

import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { normalisiereEmpfaenger } from "@/lib/classifier/normalize";
import { ladeAlle } from "@/lib/supabase/fetch-all";
import { lieferantNotizCreateSchema } from "@/lib/validation/lieferant-notiz";
import {
  gruppiereNotizen,
  type LieferantNotiz,
  type LieferantNotizGruppe,
  type LieferantNotizRow,
} from "@/lib/finanzen/lieferant-notizen";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LieferantNotizenListeResponse {
  /** Gruppiert (Modus „alle"). */
  gruppen?: LieferantNotizGruppe[];
  /** Flach (Modus „?norm=" / „?buchung_id="). */
  notizen?: LieferantNotiz[];
  /** Aufgelöster Schlüssel im Modus „?buchung_id=". */
  empfaenger_norm?: string | null;
}

const SELECT =
  "id, empfaenger_norm, rohwert_beispiel, inhalt, erstellt_am, aktualisiert_am";

function toNotiz(r: LieferantNotizRow): LieferantNotiz {
  return {
    id: r.id,
    empfaenger_norm: r.empfaenger_norm,
    inhalt: r.inhalt,
    erstellt_am: r.erstellt_am,
    aktualisiert_am: r.aktualisiert_am,
  };
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const normParam = url.searchParams.get("norm");
  const buchungId = url.searchParams.get("buchung_id");
  const supabase = await createClient();

  // --- Modus: eine Buchung → deren Empfänger auflösen --------------------
  if (buchungId) {
    if (!UUID.test(buchungId)) {
      return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
    }
    const { data: b } = await supabase
      .from("buchung")
      .select("empfaenger, empfaenger_normalisiert")
      .eq("owner_id", user.id)
      .eq("id", buchungId)
      .maybeSingle();
    const norm =
      (b?.empfaenger_normalisiert ?? "").trim() ||
      normalisiereEmpfaenger(b?.empfaenger ?? null);
    if (!norm) {
      return NextResponse.json({
        notizen: [],
        empfaenger_norm: null,
      } satisfies LieferantNotizenListeResponse);
    }
    const { data, error } = await supabase
      .from("lieferant_notiz")
      .select(SELECT)
      .eq("owner_id", user.id)
      .eq("empfaenger_norm", norm)
      .order("erstellt_am", { ascending: false })
      .limit(200);
    if (error) {
      return NextResponse.json(
        { error: "Notizen konnten nicht geladen werden." },
        { status: 500 },
      );
    }
    return NextResponse.json({
      notizen: ((data ?? []) as LieferantNotizRow[]).map(toNotiz),
      empfaenger_norm: norm,
    } satisfies LieferantNotizenListeResponse);
  }

  // --- Modus: ein Lieferant (flach) --------------------------------------
  if (normParam !== null) {
    const norm = normParam.trim().slice(0, 300);
    if (norm.length < 2) {
      return NextResponse.json(
        { error: "Ungültiger Schlüssel." },
        { status: 400 },
      );
    }
    const { data, error } = await supabase
      .from("lieferant_notiz")
      .select(SELECT)
      .eq("owner_id", user.id)
      .eq("empfaenger_norm", norm)
      .order("erstellt_am", { ascending: false })
      .limit(200);
    if (error) {
      return NextResponse.json(
        { error: "Notizen konnten nicht geladen werden." },
        { status: 500 },
      );
    }
    return NextResponse.json({
      notizen: ((data ?? []) as LieferantNotizRow[]).map(toNotiz),
      empfaenger_norm: norm,
    } satisfies LieferantNotizenListeResponse);
  }

  // --- Modus: alle (gruppiert, für die Übersichtsseite) ------------------
  const { data, error } = await supabase
    .from("lieferant_notiz")
    .select(SELECT)
    .eq("owner_id", user.id)
    .order("aktualisiert_am", { ascending: false })
    .limit(2000);
  if (error) {
    return NextResponse.json(
      { error: "Notizen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const rows = (data ?? []) as LieferantNotizRow[];

  // Anzeigenamen aus Buchungen ableiten (häufigste Roh-Schreibweise je norm).
  const normWerte = Array.from(new Set(rows.map((r) => r.empfaenger_norm)));
  const anzeigeNamen = new Map<string, string>();
  if (normWerte.length > 0) {
    const { data: buchungen } = await ladeAlle((von, bis) =>
      supabase
        .from("buchung")
        .select("empfaenger_normalisiert, empfaenger")
        .eq("owner_id", user.id)
        .in("empfaenger_normalisiert", normWerte)
        .order("id", { ascending: true })
        .range(von, bis),
    );
    const haeufigkeit = new Map<string, Map<string, number>>();
    for (const b of (buchungen ?? []) as Array<{
      empfaenger_normalisiert: string | null;
      empfaenger: string | null;
    }>) {
      const norm = (b.empfaenger_normalisiert ?? "").trim();
      const roh = (b.empfaenger ?? "").trim();
      if (!norm || !roh) continue;
      const zaehler = haeufigkeit.get(norm) ?? new Map<string, number>();
      zaehler.set(roh, (zaehler.get(roh) ?? 0) + 1);
      haeufigkeit.set(norm, zaehler);
    }
    for (const [norm, zaehler] of haeufigkeit) {
      let bestName = "";
      let bestAnzahl = 0;
      for (const [name, anzahl] of zaehler) {
        if (anzahl > bestAnzahl) {
          bestAnzahl = anzahl;
          bestName = name;
        }
      }
      if (bestName) anzeigeNamen.set(norm, bestName);
    }
  }

  return NextResponse.json({
    gruppen: gruppiereNotizen(rows, anzeigeNamen),
  } satisfies LieferantNotizenListeResponse);
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
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }
  const parsed = lieferantNotizCreateSchema.safeParse(body);
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
      { error: "Empfänger ergibt keinen gültigen Schlüssel." },
      { status: 422 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lieferant_notiz")
    .insert({
      owner_id: user.id,
      empfaenger_norm: norm,
      rohwert_beispiel: rohwert,
      inhalt: parsed.data.inhalt,
    })
    .select(SELECT)
    .single();
  if (error) {
    console.error("lieferant_notiz insert:", error.message);
    return NextResponse.json(
      { error: "Anlegen fehlgeschlagen." },
      { status: 500 },
    );
  }

  await supabase.from("audit_eintrag").insert({
    owner_id: user.id,
    entitaet: "lieferant_notiz",
    entitaet_id: data.id,
    aktion: "notiz_angelegt",
    quelle: "nutzer",
    details: { empfaenger_norm: norm },
  });

  return NextResponse.json(
    { notiz: toNotiz(data as LieferantNotizRow) },
    { status: 201 },
  );
}
