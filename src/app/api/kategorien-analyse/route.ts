// PROJ-14: Aggregation aller Buchungen je Kategorie für die Analyse-Übersicht.
// GET /api/kategorien-analyse?jahr=&konto_id=&nur_steuerrelevant=
//
// Liefert je Kategorie: Anzahl, Summe, ⌀ Konfidenz, Status-Mix.
// Plus eine virtuelle Zeile "— ohne Kategorie —" für Buchungen ohne
// kategorie_id (typischerweise Prüflisten-Fälle).
//
// Aggregation serverseitig in JavaScript — bei <10k Buchungen schnell genug,
// keine RPC-Abhängigkeit. Auth Pflicht (getApiUser), owner-scoped.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser } from "@/lib/auth/guard";
import { analyseFilterSchema } from "@/lib/validation/kategorien-analyse";
import type { BuchungStatus, KategorieTyp, Klassifikation } from "@/lib/types";

interface BuchungRow {
  id: string;
  konto_id: string;
  buchung_datum: string;
  betrag: number;
  klassifikation: Klassifikation | null;
  steuerrelevant: boolean | null;
  kategorie_id: string | null;
  konfidenz: number | null;
  status: BuchungStatus;
}

interface KategorieRow {
  id: string;
  bezeichnung: string;
  typ: KategorieTyp;
  ust_satz: number | null;
  aktiv: boolean;
}

export interface KategorieAggregat {
  kategorie_id: string | null;
  bezeichnung: string;
  typ: KategorieTyp | "ohne";
  ust_satz: number | null;
  aktiv: boolean;
  anzahl: number;
  summe: number;
  konfidenz_avg: number | null;
  status_mix: Record<BuchungStatus, number>;
  klassifikation_mix: Record<Klassifikation | "ohne", number>;
  /** Anzahl Buchungen mit niedriger Konfidenz (<0.7) — Audit-Hinweis. */
  unsicher: number;
}

export interface AnalyseResponse {
  kategorien: KategorieAggregat[];
  /** Globale Eckdaten zum Filter-Ergebnis. */
  gesamt: {
    buchungen: number;
    summe: number;
    auto_verbucht: number;
    zur_pruefung: number;
    manuell_bestaetigt: number;
  };
}

export async function GET(request: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = analyseFilterSchema.safeParse({
    jahr: url.searchParams.get("jahr") ?? undefined,
    konto_id: url.searchParams.get("konto_id") ?? undefined,
    nur_steuerrelevant: url.searchParams.get("nur_steuerrelevant") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültiger Filter" },
      { status: 422 },
    );
  }
  const filter = parsed.data;

  const supabase = await createClient();

  // Buchungen laden — auf Filter eingeschränkt.
  let q = supabase
    .from("buchung")
    .select(
      "id, konto_id, buchung_datum, betrag, klassifikation, steuerrelevant, kategorie_id, konfidenz, status",
    )
    .eq("owner_id", user.id)
    .limit(20000);
  if (filter.jahr) {
    q = q.gte("buchung_datum", `${filter.jahr}-01-01`).lte(
      "buchung_datum",
      `${filter.jahr}-12-31`,
    );
  }
  if (filter.konto_id) q = q.eq("konto_id", filter.konto_id);
  if (filter.nur_steuerrelevant) q = q.eq("steuerrelevant", true);

  const { data: bData, error: bErr } = await q;
  if (bErr) {
    return NextResponse.json(
      { error: "Buchungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const buchungen = (bData ?? []) as BuchungRow[];

  const { data: kData, error: kErr } = await supabase
    .from("kategorie")
    .select("id, bezeichnung, typ, ust_satz, aktiv")
    .eq("owner_id", user.id)
    .limit(1000);
  if (kErr) {
    return NextResponse.json(
      { error: "Kategorien konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const kategorien = (kData ?? []) as KategorieRow[];
  const katMap = new Map(kategorien.map((k) => [k.id, k]));

  // Aggregation
  const acc = new Map<string, KategorieAggregat>();
  const ohneKey = "__ohne__";

  function neuesAggregat(
    id: string | null,
    bezeichnung: string,
    typ: KategorieTyp | "ohne",
    ust_satz: number | null,
    aktiv: boolean,
  ): KategorieAggregat {
    return {
      kategorie_id: id,
      bezeichnung,
      typ,
      ust_satz,
      aktiv,
      anzahl: 0,
      summe: 0,
      konfidenz_avg: null,
      status_mix: {
        offen: 0,
        auto_verbucht: 0,
        zur_pruefung: 0,
        manuell_bestaetigt: 0,
      },
      klassifikation_mix: {
        privat: 0,
        geschaeftlich: 0,
        unklar: 0,
        neutral: 0,
        ohne: 0,
      },
      unsicher: 0,
    };
  }

  // Hilfsvariable: Konfidenz-Summe je Kategorie für Mittelwert
  const konfSum = new Map<string, { sum: number; n: number }>();

  for (const b of buchungen) {
    const betrag = Number(b.betrag) || 0;
    let key: string;
    let agg: KategorieAggregat;
    if (b.kategorie_id) {
      const k = katMap.get(b.kategorie_id);
      key = b.kategorie_id;
      agg =
        acc.get(key) ??
        neuesAggregat(
          b.kategorie_id,
          k?.bezeichnung ?? "(unbekannte Kategorie)",
          k?.typ ?? "ohne",
          k?.ust_satz ?? null,
          k?.aktiv ?? false,
        );
    } else {
      key = ohneKey;
      agg =
        acc.get(key) ??
        neuesAggregat(null, "— ohne Kategorie —", "ohne", null, true);
    }
    agg.anzahl++;
    agg.summe += betrag;
    agg.status_mix[b.status]++;
    if (b.klassifikation) agg.klassifikation_mix[b.klassifikation]++;
    else agg.klassifikation_mix.ohne++;
    if (b.konfidenz !== null) {
      const k = konfSum.get(key) ?? { sum: 0, n: 0 };
      k.sum += Number(b.konfidenz);
      k.n++;
      konfSum.set(key, k);
      if (Number(b.konfidenz) < 0.7) agg.unsicher++;
    }
    acc.set(key, agg);
  }

  for (const [key, agg] of acc) {
    const k = konfSum.get(key);
    if (k && k.n > 0) {
      agg.konfidenz_avg = Math.round((k.sum / k.n) * 100) / 100;
    }
    // Auf 2 Nachkommastellen runden — Cent-Genauigkeit.
    agg.summe = Math.round(agg.summe * 100) / 100;
  }

  // Auch Kategorien ohne Buchung mit aufnehmen — als Leere-Zeile.
  for (const k of kategorien) {
    if (!acc.has(k.id)) {
      acc.set(k.id, neuesAggregat(k.id, k.bezeichnung, k.typ, k.ust_satz, k.aktiv));
    }
  }

  // Sortierung: erst nach Typ-Reihenfolge (einnahme, ausgabe, privat, neutral, ohne),
  // dann nach absoluter Summe absteigend.
  const typReihenfolge: Record<KategorieTyp | "ohne", number> = {
    einnahme: 0,
    ausgabe: 1,
    privat: 2,
    neutral: 3,
    ohne: 4,
  };
  const result: KategorieAggregat[] = Array.from(acc.values()).sort((a, b) => {
    if (typReihenfolge[a.typ] !== typReihenfolge[b.typ]) {
      return typReihenfolge[a.typ] - typReihenfolge[b.typ];
    }
    return Math.abs(b.summe) - Math.abs(a.summe);
  });

  // Gesamtsummen
  const gesamt = {
    buchungen: buchungen.length,
    summe:
      Math.round(buchungen.reduce((s, b) => s + (Number(b.betrag) || 0), 0) * 100) /
      100,
    auto_verbucht: buchungen.filter((b) => b.status === "auto_verbucht").length,
    zur_pruefung: buchungen.filter((b) => b.status === "zur_pruefung").length,
    manuell_bestaetigt: buchungen.filter((b) => b.status === "manuell_bestaetigt")
      .length,
  };

  const payload: AnalyseResponse = { kategorien: result, gesamt };
  return NextResponse.json(payload);
}
