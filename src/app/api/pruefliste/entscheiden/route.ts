// PROJ-7: Entscheidung über Prüffälle (Einzel- oder Bulk).
//
// POST -> setzt für eine oder mehrere Buchungen die manuelle Entscheidung:
//         kategorie_id, ust_satz, klassifikation; Status wird auf
//         'manuell_bestaetigt' gesetzt (UNVERÄNDERLICH gegenüber
//         Re-Klassifizierung — der Schutz ist in der Pipeline implementiert,
//         hier wird nur der Status gesetzt und nie eine bereits manuell
//         bestätigte Buchung erneut verändert). quelle='manuell'.
//         Optional:
//           - Betrag-Split in zwei Teilbuchungen (Privatanteil); die
//             Original-Buchung wird zur Klammer (status 'manuell_bestaetigt'),
//             zwei Kinder mit parent_buchung_id + split_anteil entstehen.
//           - Beleg-Zuordnungs-Hinweis (frei, wird im Audit hinterlegt).
//           - Aus der Entscheidung eine Lernregel erzeugen (regel_anlegen).
//         Jede Entscheidung erzeugt einen audit_eintrag.
//
// Auth Pflicht (getApiUser → 401). Owner-scoped zusätzlich zur RLS. Zod.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { KLASSIFIKATIONEN } from "@/lib/validation/regel";
import { normalisiereEmpfaenger } from "@/lib/classifier/normalize";
import { wendeSplitAn } from "@/lib/classifier/split-apply";
import type { Buchung, Klassifikation } from "@/lib/types";

const ustSchema = z
  .union([z.literal(0), z.literal(7), z.literal(19)])
  .nullable();

/** Optionaler Split in genau zwei Teile (Anteile in 0..1, Summe = 1). */
const splitSchema = z
  .object({
    anteil_a: z.number().gt(0).lt(1),
    klassifikation_a: z.enum(KLASSIFIKATIONEN),
    kategorie_id_a: z.uuid().nullable().optional().default(null),
    klassifikation_b: z.enum(KLASSIFIKATIONEN),
    kategorie_id_b: z.uuid().nullable().optional().default(null),
  })
  .refine((s) => s.anteil_a > 0 && s.anteil_a < 1, {
    error: "Anteil muss zwischen 0 und 1 liegen (z. B. 0.6 für 60 %).",
    path: ["anteil_a"],
  });

const regelAnlegenSchema = z.object({
  bezeichnung: z.string().trim().min(2).max(120),
  empfaenger_muster: z.string().trim().max(200).optional(),
  zweck_muster: z.string().trim().max(200).optional(),
  konto_id: z.uuid().optional(),
  prioritaet: z.number().int().min(0).max(1000).optional().default(100),
});

const entscheidenSchema = z
  .object({
    buchung_ids: z
      .array(z.uuid())
      .min(1, "Mindestens einen Fall auswählen.")
      .max(500, "Höchstens 500 Fälle pro Aktion."),
    kategorie_id: z.uuid().nullable().optional().default(null),
    ust_satz: ustSchema.optional().default(null),
    klassifikation: z.enum(KLASSIFIKATIONEN),
    beleg_hinweis: z.string().trim().max(500).optional(),
    split: splitSchema.optional(),
    regel_anlegen: regelAnlegenSchema.optional(),
  })
  .refine((d) => !(d.split && d.buchung_ids.length > 1), {
    error: "Ein Betrag-Split ist nur für einen einzelnen Fall möglich.",
    path: ["split"],
  });

const SELECT_FELDER =
  "id, owner_id, konto_id, buchung_datum, betrag, verwendungszweck, empfaenger, waehrung, klassifikation, steuerrelevant, kategorie_id, ust_satz, begruendung, konfidenz, quelle, status, pruef_grund, parent_buchung_id, split_anteil, duplikat_hash";

type BuchungRow = Buchung & {
  owner_id: string;
  duplikat_hash: string;
};

function steuerrelevantAus(k: Klassifikation): boolean | null {
  if (k === "geschaeftlich") return true;
  if (k === "privat" || k === "neutral") return false;
  return null;
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

  const parsed = entscheidenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validierung fehlgeschlagen.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }
  const eingabe = parsed.data;
  const supabase = await createClient();

  // Nur offene Prüffälle des Eigentümers behandeln — bereits manuell
  // bestätigte Buchungen werden NIE angefasst (Unveränderlichkeit).
  const { data: faelleData, error: ladeErr } = await supabase
    .from("buchung")
    .select(SELECT_FELDER)
    .eq("owner_id", user.id)
    .eq("status", "zur_pruefung")
    .in("id", eingabe.buchung_ids)
    .limit(500);

  if (ladeErr) {
    return NextResponse.json(
      { error: "Prüffälle konnten nicht geladen werden." },
      { status: 500 },
    );
  }
  const faelle = (faelleData ?? []) as BuchungRow[];
  if (faelle.length === 0) {
    return NextResponse.json(
      {
        error:
          "Keine offenen Prüffälle gefunden (evtl. bereits entschieden).",
      },
      { status: 409 },
    );
  }

  const steuerrelevant = steuerrelevantAus(eingabe.klassifikation);
  let bearbeitet = 0;
  const fehler: Array<{ buchung_id: string; grund: string }> = [];

  // ---- Split-Sonderfall (genau ein Fall) --------------------------------
  if (eingabe.split) {
    const f = faelle[0];
    // PROJ-15: Kind-Buchungen erben den Empfaenger 1:1 von der Klammer und
    // bekommen damit denselben normalisierten Schluessel — wichtig fuer
    // Cache-/Historie-Lookups. Die Aufteilungslogik liegt jetzt in
    // `wendeSplitAn` (geteilt mit der Pipeline-Split-Aktion).
    const res = await wendeSplitAn(
      supabase,
      {
        id: f.id,
        owner_id: user.id,
        konto_id: f.konto_id,
        buchung_datum: f.buchung_datum,
        betrag: f.betrag,
        verwendungszweck: f.verwendungszweck,
        empfaenger: f.empfaenger,
        empfaenger_normalisiert: normalisiereEmpfaenger(f.empfaenger),
        waehrung: f.waehrung,
        duplikat_hash: f.duplikat_hash,
      },
      {
        anteil_a: eingabe.split.anteil_a,
        klassifikation_a: eingabe.split.klassifikation_a,
        kategorie_id_a: eingabe.split.kategorie_id_a,
        ust_satz_a: eingabe.ust_satz,
        klassifikation_b: eingabe.split.klassifikation_b,
        kategorie_id_b: eingabe.split.kategorie_id_b,
        ust_satz_b: eingabe.ust_satz,
      },
      {
        aktion: "manuell_aufgeteilt",
        quelle: "nutzer",
        kind_quelle: "manuell",
        kind_begruendung: "Teilbuchung aus manueller Aufteilung.",
        audit_details: { beleg_hinweis: eingabe.beleg_hinweis ?? null },
      },
    );
    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            res.fehler === "kinder_insert"
              ? "Teilbuchungen konnten nicht angelegt werden."
              : "Klammerbuchung konnte nicht aktualisiert werden.",
        },
        { status: 500 },
      );
    }
    bearbeitet = 1;
  } else {
    // ---- Normalfall: Einzel-/Bulk-Entscheidung -------------------------
    for (const f of faelle) {
      const { error: updErr } = await supabase
        .from("buchung")
        .update({
          klassifikation: eingabe.klassifikation,
          steuerrelevant,
          kategorie_id: eingabe.kategorie_id,
          ust_satz: eingabe.ust_satz,
          begruendung: "Manuell in der Prüfliste entschieden.",
          konfidenz: 1,
          quelle: "manuell",
          status: "manuell_bestaetigt",
          pruef_grund: null,
        })
        .eq("id", f.id)
        .eq("owner_id", user.id)
        .neq("status", "manuell_bestaetigt"); // letzte Sicherung
      if (updErr) {
        fehler.push({
          buchung_id: f.id,
          grund: "Buchung konnte nicht aktualisiert werden.",
        });
        continue;
      }
      await supabase.from("audit_eintrag").insert({
        owner_id: user.id,
        entitaet: "buchung",
        entitaet_id: f.id,
        aktion: "manuell_bestaetigt",
        quelle: "nutzer",
        details: {
          klassifikation: eingabe.klassifikation,
          kategorie_id: eingabe.kategorie_id,
          ust_satz: eingabe.ust_satz,
          beleg_hinweis: eingabe.beleg_hinweis ?? null,
        },
      });
      bearbeitet += 1;
    }
  }

  // ---- Optional: Lernregel aus der Entscheidung erzeugen ----------------
  let regel: { id: string; bezeichnung: string } | null = null;
  if (eingabe.regel_anlegen) {
    const ra = eingabe.regel_anlegen;
    const empf =
      ra.empfaenger_muster && ra.empfaenger_muster.length > 0
        ? ra.empfaenger_muster
        : undefined;
    const zweck =
      ra.zweck_muster && ra.zweck_muster.length > 0
        ? ra.zweck_muster
        : undefined;
    const bedingung: Record<string, unknown> = {};
    if (empf) bedingung.empfaenger_muster = empf;
    if (zweck) bedingung.zweck_muster = zweck;
    if (ra.konto_id) bedingung.konto_id = ra.konto_id;

    if (Object.keys(bedingung).length === 0) {
      // Keine brauchbare Bedingung → Regel überspringen, Rest war ok.
      fehler.push({
        buchung_id: "-",
        grund:
          "Lernregel nicht angelegt: keine Bedingung (Empfänger/Zweck/Konto) vorhanden.",
      });
    } else {
      const aktion: Record<string, unknown> = {
        klassifikation: eingabe.klassifikation,
      };
      if (eingabe.kategorie_id) aktion.kategorie_id = eingabe.kategorie_id;
      if (eingabe.ust_satz !== null) aktion.ust_satz = eingabe.ust_satz;

      const { data: regelData, error: regelErr } = await supabase
        .from("lernregel")
        .insert({
          owner_id: user.id,
          bezeichnung: ra.bezeichnung,
          bedingung,
          aktion,
          prioritaet: ra.prioritaet,
          aktiv: true,
        })
        .select("id, bezeichnung")
        .single();
      if (regelErr) {
        fehler.push({
          buchung_id: "-",
          grund: "Lernregel konnte nicht angelegt werden.",
        });
      } else {
        regel = regelData as { id: string; bezeichnung: string };
      }
    }
  }

  // ---- Optional: gleichartige offene Fälle als Angebot ------------------
  // Wenn eine Regel angelegt wurde, zeigen wir, wie viele weitere offene
  // Prüffälle dieselbe Bedingung erfüllen (der Client kann sie nachreichen).
  let gleichartige_offen = 0;
  if (regel && eingabe.regel_anlegen) {
    const ra = eingabe.regel_anlegen;
    let q = supabase
      .from("buchung")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .eq("status", "zur_pruefung")
      .not("id", "in", `(${eingabe.buchung_ids.join(",")})`);
    if (ra.empfaenger_muster) {
      q = q.ilike("empfaenger", `%${ra.empfaenger_muster}%`);
    }
    if (ra.zweck_muster) {
      q = q.ilike("verwendungszweck", `%${ra.zweck_muster}%`);
    }
    if (ra.konto_id) {
      q = q.eq("konto_id", ra.konto_id);
    }
    const { count } = await q;
    gleichartige_offen = count ?? 0;
  }

  return NextResponse.json({
    ok: fehler.length === 0,
    bearbeitet,
    fehler,
    regel,
    gleichartige_offen,
  });
}
