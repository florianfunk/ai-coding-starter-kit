import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import type { KategorieTyp } from "@/lib/types";

const SELECT_FELDER =
  "id, bezeichnung, typ, ust_satz, euer_zeile, elster_kennzahl, aktiv, gueltig_ab";

type SeedKategorie = {
  bezeichnung: string;
  typ: KategorieTyp;
  ust_satz: number | null;
  euer_zeile: string;
  elster_kennzahl: string | null;
};

/**
 * Standard-Kontenrahmen für Einzelunternehmer / Freiberufler.
 * An die Anlage EÜR angelehnt (Zeilen-Hinweise als Klartext) und mit
 * plausiblen ELSTER-USt-Kennzahlen (USt-VA Hauptkennzahlen) belegt.
 * Werte sind als pflegbare Stammdaten gedacht — Nutzer kann alles anpassen.
 */
const STANDARD_KONTENRAHMEN: SeedKategorie[] = [
  // ----- Einnahmen -----
  {
    bezeichnung: "Umsatzerlöse 19% USt",
    typ: "einnahme",
    ust_satz: 19,
    euer_zeile: "Anlage EÜR Z. 14 – Betriebseinnahmen 19%",
    elster_kennzahl: "81",
  },
  {
    bezeichnung: "Umsatzerlöse 7% USt",
    typ: "einnahme",
    ust_satz: 7,
    euer_zeile: "Anlage EÜR Z. 14 – Betriebseinnahmen 7%",
    elster_kennzahl: "86",
  },
  {
    bezeichnung: "Steuerfreie / nicht steuerbare Einnahmen",
    typ: "einnahme",
    ust_satz: 0,
    euer_zeile: "Anlage EÜR Z. 15 – umsatzsteuerfreie Einnahmen",
    elster_kennzahl: "48",
  },
  {
    bezeichnung: "Einnahmen aus selbständiger Arbeit (Honorare) 19%",
    typ: "einnahme",
    ust_satz: 19,
    euer_zeile: "Anlage EÜR Z. 14 – Betriebseinnahmen 19%",
    elster_kennzahl: "81",
  },
  {
    bezeichnung: "Vereinnahmte Umsatzsteuer",
    typ: "einnahme",
    ust_satz: 0,
    euer_zeile: "Anlage EÜR Z. 16 – vereinnahmte USt",
    elster_kennzahl: null,
  },

  // ----- Ausgaben -----
  {
    bezeichnung: "Wareneinkauf",
    typ: "ausgabe",
    ust_satz: 19,
    euer_zeile: "Anlage EÜR Z. 26 – Waren/Roh-/Hilfsstoffe",
    elster_kennzahl: "66",
  },
  {
    bezeichnung: "Fremdleistungen / Subunternehmer",
    typ: "ausgabe",
    ust_satz: 19,
    euer_zeile: "Anlage EÜR Z. 27 – bezogene Fremdleistungen",
    elster_kennzahl: "66",
  },
  {
    bezeichnung: "Bürobedarf",
    typ: "ausgabe",
    ust_satz: 19,
    euer_zeile: "Anlage EÜR Z. 51 – sonstige unbeschränkt abziehbare BA",
    elster_kennzahl: "66",
  },
  {
    bezeichnung: "Telefon / Internet",
    typ: "ausgabe",
    ust_satz: 19,
    euer_zeile: "Anlage EÜR Z. 48 – Kommunikationskosten",
    elster_kennzahl: "66",
  },
  {
    bezeichnung: "KFZ-Kosten",
    typ: "ausgabe",
    ust_satz: 19,
    euer_zeile: "Anlage EÜR Z. 38 – Kfz-Kosten",
    elster_kennzahl: "66",
  },
  {
    bezeichnung: "Reisekosten",
    typ: "ausgabe",
    ust_satz: 19,
    euer_zeile: "Anlage EÜR Z. 49 – Reisekosten",
    elster_kennzahl: "66",
  },
  {
    bezeichnung: "Miete / Raumkosten",
    typ: "ausgabe",
    ust_satz: 19,
    euer_zeile: "Anlage EÜR Z. 37 – Raumkosten",
    elster_kennzahl: "66",
  },
  {
    bezeichnung: "Versicherungen / Beiträge",
    typ: "ausgabe",
    ust_satz: 0,
    euer_zeile: "Anlage EÜR Z. 50 – Versicherungen/Beiträge",
    elster_kennzahl: null,
  },
  {
    bezeichnung: "Abschreibungen (AfA)",
    typ: "ausgabe",
    ust_satz: 0,
    euer_zeile: "Anlage EÜR Z. 29 – Absetzung für Abnutzung",
    elster_kennzahl: null,
  },
  {
    bezeichnung: "Sonstige Betriebsausgaben",
    typ: "ausgabe",
    ust_satz: 19,
    euer_zeile: "Anlage EÜR Z. 51 – sonstige unbeschränkt abziehbare BA",
    elster_kennzahl: "66",
  },
  {
    bezeichnung: "Gezahlte Vorsteuer",
    typ: "ausgabe",
    ust_satz: 0,
    euer_zeile: "Anlage EÜR Z. 55 – gezahlte Vorsteuer",
    elster_kennzahl: null,
  },

  // ----- Privat (kein Vorsteuerabzug) -----
  {
    bezeichnung: "Privatentnahme",
    typ: "privat",
    ust_satz: null,
    euer_zeile: "Privatsphäre – keine EÜR-Auswirkung",
    elster_kennzahl: null,
  },
  {
    bezeichnung: "Privateinlage",
    typ: "privat",
    ust_satz: null,
    euer_zeile: "Privatsphäre – keine EÜR-Auswirkung",
    elster_kennzahl: null,
  },

  // ----- Neutral (Geldtransit / Durchlaufend) -----
  {
    bezeichnung: "Geldtransit (Umbuchung zwischen Konten)",
    typ: "neutral",
    ust_satz: null,
    euer_zeile: "Neutral – keine EÜR-Auswirkung",
    elster_kennzahl: null,
  },
  {
    bezeichnung: "USt-Zahllast / -Erstattung Finanzamt",
    typ: "neutral",
    ust_satz: null,
    euer_zeile: "Neutral – keine EÜR-Auswirkung",
    elster_kennzahl: null,
  },
];

/**
 * POST /api/kontenrahmen/seed
 * Legt den Standard-Kontenrahmen an. Idempotent: bereits vorhandene
 * Bezeichnungen werden übersprungen (kein doppeltes Anlegen).
 */
export async function POST() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const supabase = await createClient();

  const { data: vorhandene, error: leseFehler } = await supabase
    .from("kategorie")
    .select("bezeichnung")
    .eq("owner_id", user.id)
    .limit(1000);

  if (leseFehler) {
    return NextResponse.json(
      { error: "Bestehender Kontenrahmen konnte nicht geprüft werden" },
      { status: 500 },
    );
  }

  const vorhandeneNamen = new Set(
    (vorhandene ?? []).map((k) => k.bezeichnung),
  );
  const anzulegen = STANDARD_KONTENRAHMEN.filter(
    (k) => !vorhandeneNamen.has(k.bezeichnung),
  );

  if (anzulegen.length === 0) {
    return NextResponse.json({
      data: [],
      angelegt: 0,
      uebersprungen: STANDARD_KONTENRAHMEN.length,
      message: "Standard-Kontenrahmen ist bereits vollständig vorhanden",
    });
  }

  const { data, error } = await supabase
    .from("kategorie")
    .insert(anzulegen.map((k) => ({ ...k, owner_id: user.id })))
    .select(SELECT_FELDER);

  if (error) {
    return NextResponse.json(
      { error: "Standard-Kontenrahmen konnte nicht angelegt werden" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      data: data ?? [],
      angelegt: data?.length ?? 0,
      uebersprungen: STANDARD_KONTENRAHMEN.length - (data?.length ?? 0),
      message: `${data?.length ?? 0} Kategorien angelegt`,
    },
    { status: 201 },
  );
}
