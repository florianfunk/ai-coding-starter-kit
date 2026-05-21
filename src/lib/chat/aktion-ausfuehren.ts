// PROJ-17 — Aktions-Ausfuehrer (Confirm-Flow).
//
// Wird vom Confirm-Endpoint aufgerufen, NACHDEM der Nutzer im UI auf
// "Bestaetigen" geklickt hat. Verantwortlich fuer:
//   1) Vorschlag aus DB laden (NICHT aus Request-Body — Replay-Schutz).
//   2) Idempotenz pruefen (status='pending_confirm' → ja; sonst 409).
//   3) Owner verifizieren (zusaetzlich zur RLS).
//   4) Lost-Update-Schutz: pro Tool die betroffenen Datensaetze nochmal
//      pruefen — wenn sie sich seit dem Vorschlag geaendert haben,
//      Ausfuehrung abbrechen (status='error').
//   5) Mutation in Batches ausfuehren.
//   6) audit_eintrag mit quelle='chat' anlegen.
//   7) chat_aktion.status='confirmed' + audit_eintrag_id setzen.
//
// Auch der Abbrechen-Endpoint liegt hier — simpel.

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BuchungStatus,
  Klassifikation,
  KategorieTyp,
} from "@/lib/types";
import {
  SCHREIB_TOOL_NAMEN,
  type SchreibToolName,
} from "./tools-schreib";

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export interface AktionRow {
  id: string;
  owner_id: string;
  konversation_id: string;
  nachricht_id: string;
  aktion: string;
  parameter: Record<string, unknown>;
  vorschau: string;
  vorher_nachher: unknown;
  status: "pending_confirm" | "confirmed" | "cancelled" | "error";
  audit_eintrag_id: string | null;
  fehler_text: string | null;
}

export type AusfuehrFehlerCode =
  | "not_found"
  | "forbidden"
  | "conflict"
  | "validation"
  | "lost_update"
  | "db_error";

export interface AusfuehrFehler {
  ok: false;
  code: AusfuehrFehlerCode;
  message: string;
  /** HTTP-Status, den der API-Endpoint zurueckgeben sollte. */
  status: 400 | 404 | 409 | 422 | 500;
}

export interface AusfuehrErfolg {
  ok: true;
  /** Zusammenfassung fuer den Chat ("3 Buchungen umgebucht auf …"). */
  zusammenfassung: string;
  /** Wie viele Datensaetze tatsaechlich veraendert wurden. */
  aktualisiert: number;
  audit_eintrag_id: string | null;
  ausgefuehrt_am: string;
}

export type AusfuehrErgebnis = AusfuehrErfolg | AusfuehrFehler;

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

function istSchreibToolName(s: string): s is SchreibToolName {
  return (SCHREIB_TOOL_NAMEN as readonly string[]).includes(s);
}

async function ladeAktion(
  supabase: SupabaseClient,
  ownerId: string,
  aktion_id: string,
): Promise<AktionRow | null> {
  const { data, error } = await supabase
    .from("chat_aktion")
    .select(
      "id, owner_id, konversation_id, nachricht_id, aktion, parameter, vorschau, vorher_nachher, status, audit_eintrag_id, fehler_text",
    )
    .eq("owner_id", ownerId)
    .eq("id", aktion_id)
    .maybeSingle();
  if (error || !data) return null;
  return data as AktionRow;
}

async function setzeStatus(
  supabase: SupabaseClient,
  aktion_id: string,
  patch: Partial<{
    status: AktionRow["status"];
    audit_eintrag_id: string | null;
    fehler_text: string | null;
  }>,
): Promise<void> {
  await supabase.from("chat_aktion").update(patch).eq("id", aktion_id);
}

async function schreibeAudit(
  supabase: SupabaseClient,
  ownerId: string,
  aktion: AktionRow,
  details: Record<string, unknown>,
  entitaet: string,
  entitaet_id: string | null,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("audit_eintrag")
    .insert({
      owner_id: ownerId,
      entitaet,
      entitaet_id,
      aktion: aktion.aktion,
      quelle: "chat",
      details: {
        ...details,
        chat_nachricht_id: aktion.nachricht_id,
        chat_aktion_id: aktion.id,
        chat_konversation_id: aktion.konversation_id,
      },
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}

function jetzt(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Per-Tool-Ausfuehrungslogik
// ---------------------------------------------------------------------------

async function fuehre_lege_kategorie_an(
  supabase: SupabaseClient,
  ownerId: string,
  aktion: AktionRow,
): Promise<AusfuehrErgebnis> {
  const p = aktion.parameter as {
    bezeichnung: string;
    typ: KategorieTyp;
    ust_satz?: number | null;
    steuerrelevant?: boolean;
    euer_zeile?: string;
  };

  // Lost-Update-Check: Bezeichnung darf inzwischen nicht anderweitig
  // vergeben sein.
  const { data: dup } = await supabase
    .from("kategorie")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("bezeichnung", p.bezeichnung)
    .maybeSingle();
  if (dup) {
    return {
      ok: false,
      code: "lost_update",
      message: `Eine Kategorie mit der Bezeichnung "${p.bezeichnung}" existiert inzwischen bereits.`,
      status: 409,
    };
  }

  const ustSatz =
    p.typ === "privat" || p.typ === "neutral"
      ? null
      : (p.ust_satz ?? null);
  const steuerrelevant =
    p.typ === "einnahme" || p.typ === "ausgabe";

  const { data: neu, error } = await supabase
    .from("kategorie")
    .insert({
      owner_id: ownerId,
      bezeichnung: p.bezeichnung,
      typ: p.typ,
      ust_satz: ustSatz,
      euer_zeile: p.euer_zeile ?? null,
      aktiv: true,
    })
    .select("id, bezeichnung")
    .single();
  if (error || !neu) {
    return {
      ok: false,
      code: "db_error",
      message: error?.message ?? "Anlage fehlgeschlagen.",
      status: 500,
    };
  }
  const auditId = await schreibeAudit(
    supabase,
    ownerId,
    aktion,
    { kategorie: { ...neu, typ: p.typ, ust_satz: ustSatz, steuerrelevant } },
    "kategorie",
    neu.id,
  );
  return {
    ok: true,
    zusammenfassung: `Kategorie "${neu.bezeichnung}" wurde angelegt.`,
    aktualisiert: 1,
    audit_eintrag_id: auditId,
    ausgefuehrt_am: jetzt(),
  };
}

async function fuehre_aendere_kategorie(
  supabase: SupabaseClient,
  ownerId: string,
  aktion: AktionRow,
): Promise<AusfuehrErgebnis> {
  const p = aktion.parameter as {
    kategorie_id: string;
    bezeichnung?: string;
    typ?: KategorieTyp;
    ust_satz?: number | null;
    aktiv?: boolean;
  };

  const { data: aktuell } = await supabase
    .from("kategorie")
    .select("id, bezeichnung, typ, ust_satz, aktiv")
    .eq("owner_id", ownerId)
    .eq("id", p.kategorie_id)
    .maybeSingle();
  if (!aktuell) {
    return {
      ok: false,
      code: "not_found",
      message: "Kategorie existiert nicht mehr.",
      status: 404,
    };
  }

  // Lost-Update-Check: vergleichen wir mit dem Snapshot, den der Vorschlag
  // gespeichert hat (im vorher_nachher).
  const vn = aktion.vorher_nachher as { vorher?: typeof aktuell } | null;
  if (vn?.vorher) {
    const v = vn.vorher;
    if (
      v.bezeichnung !== aktuell.bezeichnung ||
      v.typ !== aktuell.typ ||
      v.ust_satz !== aktuell.ust_satz ||
      v.aktiv !== aktuell.aktiv
    ) {
      return {
        ok: false,
        code: "lost_update",
        message:
          "Die Kategorie wurde seit dem Vorschlag von anderer Stelle geaendert. Bitte neuen Vorschlag erzeugen.",
        status: 409,
      };
    }
  }

  const updates: Record<string, unknown> = {};
  if (p.bezeichnung !== undefined) updates.bezeichnung = p.bezeichnung;
  if (p.typ !== undefined) updates.typ = p.typ;
  if (p.ust_satz !== undefined) updates.ust_satz = p.ust_satz;
  if (p.aktiv !== undefined) updates.aktiv = p.aktiv;

  const { error } = await supabase
    .from("kategorie")
    .update(updates)
    .eq("owner_id", ownerId)
    .eq("id", p.kategorie_id);
  if (error) {
    return { ok: false, code: "db_error", message: error.message, status: 500 };
  }
  const auditId = await schreibeAudit(
    supabase,
    ownerId,
    aktion,
    { vorher: aktuell, updates },
    "kategorie",
    p.kategorie_id,
  );
  return {
    ok: true,
    zusammenfassung: `Kategorie "${aktuell.bezeichnung}" wurde aktualisiert.`,
    aktualisiert: 1,
    audit_eintrag_id: auditId,
    ausgefuehrt_am: jetzt(),
  };
}

async function fuehre_loesche_kategorie(
  supabase: SupabaseClient,
  ownerId: string,
  aktion: AktionRow,
): Promise<AusfuehrErgebnis> {
  const p = aktion.parameter as { kategorie_id: string };
  const { data: kat } = await supabase
    .from("kategorie")
    .select("id, bezeichnung")
    .eq("owner_id", ownerId)
    .eq("id", p.kategorie_id)
    .maybeSingle();
  if (!kat) {
    return {
      ok: false,
      code: "not_found",
      message: "Kategorie existiert nicht (mehr).",
      status: 404,
    };
  }
  // FK ist ON DELETE SET NULL -> Buchungen verlieren kategorie_id.
  const { error } = await supabase
    .from("kategorie")
    .delete()
    .eq("owner_id", ownerId)
    .eq("id", p.kategorie_id);
  if (error) {
    return { ok: false, code: "db_error", message: error.message, status: 500 };
  }
  const auditId = await schreibeAudit(
    supabase,
    ownerId,
    aktion,
    { kategorie: kat },
    "kategorie",
    p.kategorie_id,
  );
  return {
    ok: true,
    zusammenfassung: `Kategorie "${kat.bezeichnung}" wurde geloescht.`,
    aktualisiert: 1,
    audit_eintrag_id: auditId,
    ausgefuehrt_am: jetzt(),
  };
}

async function fuehre_bucheBuchungenUm(
  supabase: SupabaseClient,
  ownerId: string,
  aktion: AktionRow,
): Promise<AusfuehrErgebnis> {
  const p = aktion.parameter as {
    buchung_ids: string[];
    neue_kategorie_id: string;
    neue_klassifikation?: Klassifikation;
  };

  const { data: kat } = await supabase
    .from("kategorie")
    .select("id, bezeichnung, typ, ust_satz")
    .eq("owner_id", ownerId)
    .eq("id", p.neue_kategorie_id)
    .maybeSingle();
  if (!kat) {
    return {
      ok: false,
      code: "not_found",
      message: "Ziel-Kategorie existiert nicht (mehr).",
      status: 404,
    };
  }

  // Lost-Update: Wenn ein Datensatz seit Vorschlag manuell_bestaetigt wurde
  // UND auf eine andere Kategorie zeigt → ueberspringen statt ueberschreiben.
  // Wir matchen die im Vorschlag aufgelisteten IDs und nehmen nur die
  // weiter, die NICHT bereits final auf einer anderen Kategorie sitzen.
  const { data: vorher, error: vErr } = await supabase
    .from("buchung")
    .select("id, kategorie_id, status")
    .eq("owner_id", ownerId)
    .in("id", p.buchung_ids);
  if (vErr) {
    return { ok: false, code: "db_error", message: vErr.message, status: 500 };
  }
  type Vorher = {
    id: string;
    kategorie_id: string | null;
    status: BuchungStatus;
  };
  const liste = (vorher ?? []) as Vorher[];

  // Schutz vor versehentlichem Ueberschreiben manuell_bestaetigter
  // Buchungen, die NICHT teil des urspruenglichen Vorschlags-Snapshots waren.
  // Wir lassen sie aus dem Update raus.
  const targetIds = liste
    .filter((b) => {
      // wenn schon korrekt zugeordnet, ist Update unnoetig, aber kein Schaden.
      if (b.kategorie_id === p.neue_kategorie_id) return true;
      // manuell_bestaetigt auf andere Kategorie → Lost-Update, ueberspringen.
      if (b.status === "manuell_bestaetigt" && b.kategorie_id) return false;
      return true;
    })
    .map((b) => b.id);
  const uebersprungen = liste.length - targetIds.length;

  if (targetIds.length === 0) {
    return {
      ok: false,
      code: "lost_update",
      message:
        "Alle ausgewaehlten Buchungen wurden zwischenzeitlich manuell bestaetigt und sind geschuetzt.",
      status: 409,
    };
  }

  // Klassifikation aus Kategorie-Typ ableiten, wenn nicht explizit gesetzt.
  let klass: Klassifikation;
  if (p.neue_klassifikation) {
    klass = p.neue_klassifikation;
  } else if (kat.typ === "privat") klass = "privat";
  else if (kat.typ === "neutral") klass = "neutral";
  else klass = "geschaeftlich";

  const updates: Record<string, unknown> = {
    kategorie_id: p.neue_kategorie_id,
    klassifikation: klass,
    steuerrelevant: kat.typ === "einnahme" || kat.typ === "ausgabe",
    ust_satz:
      kat.typ === "privat" || kat.typ === "neutral" ? null : kat.ust_satz,
    status: "manuell_bestaetigt",
    quelle: "manuell",
    pruef_grund: null,
  };

  // In Batches von 50 (siehe Spec — Edge-Case "grosser Batch").
  const batchSize = 50;
  let aktualisiert = 0;
  for (let i = 0; i < targetIds.length; i += batchSize) {
    const slice = targetIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from("buchung")
      .update(updates)
      .eq("owner_id", ownerId)
      .in("id", slice)
      .select("id");
    if (error) {
      return {
        ok: false,
        code: "db_error",
        message: error.message,
        status: 500,
      };
    }
    aktualisiert += (data ?? []).length;
  }

  // Audit-Eintrag pro Buchung (oder ein Sammel-Eintrag — wir machen 1 Sammel-
  // Eintrag mit Liste, ergaenzt um Einzel-Audits pro Batch fuer Detail-Sicht).
  const auditId = await schreibeAudit(
    supabase,
    ownerId,
    aktion,
    {
      kategorie: kat,
      buchung_ids: targetIds,
      uebersprungen,
      klassifikation: klass,
    },
    "buchung",
    null,
  );
  // Detail-Audits pro Buchung — nach demselben Muster wie bulk-kategorie/.
  await supabase.from("audit_eintrag").insert(
    targetIds.map((id) => ({
      owner_id: ownerId,
      entitaet: "buchung",
      entitaet_id: id,
      aktion: "chat_umbuchen",
      quelle: "chat",
      details: {
        kategorie: { id: kat.id, bezeichnung: kat.bezeichnung, typ: kat.typ },
        chat_nachricht_id: aktion.nachricht_id,
        chat_aktion_id: aktion.id,
      },
    })),
  );

  return {
    ok: true,
    zusammenfassung: `${aktualisiert} Buchung(en) umgebucht auf "${kat.bezeichnung}".${
      uebersprungen > 0
        ? ` ${uebersprungen} wurde(n) uebersprungen (manuell geschuetzt).`
        : ""
    }`,
    aktualisiert,
    audit_eintrag_id: auditId,
    ausgefuehrt_am: jetzt(),
  };
}

async function fuehre_manuell_bestaetige_buchungen(
  supabase: SupabaseClient,
  ownerId: string,
  aktion: AktionRow,
): Promise<AusfuehrErgebnis> {
  const p = aktion.parameter as { buchung_ids: string[] };

  // Nur Buchungen, die noch nicht manuell_bestaetigt sind, anfassen.
  const { data: vorher } = await supabase
    .from("buchung")
    .select("id, status")
    .eq("owner_id", ownerId)
    .in("id", p.buchung_ids);
  type V = { id: string; status: BuchungStatus };
  const liste = (vorher ?? []) as V[];
  const offen = liste.filter((b) => b.status !== "manuell_bestaetigt").map((b) => b.id);
  if (offen.length === 0) {
    return {
      ok: true,
      zusammenfassung:
        "Alle ausgewaehlten Buchungen sind bereits manuell bestaetigt.",
      aktualisiert: 0,
      audit_eintrag_id: null,
      ausgefuehrt_am: jetzt(),
    };
  }
  let aktualisiert = 0;
  for (let i = 0; i < offen.length; i += 50) {
    const slice = offen.slice(i, i + 50);
    const { data, error } = await supabase
      .from("buchung")
      .update({
        status: "manuell_bestaetigt",
        pruef_grund: null,
        quelle: "manuell",
      })
      .eq("owner_id", ownerId)
      .in("id", slice)
      .select("id");
    if (error) {
      return { ok: false, code: "db_error", message: error.message, status: 500 };
    }
    aktualisiert += (data ?? []).length;
  }
  const auditId = await schreibeAudit(
    supabase,
    ownerId,
    aktion,
    { buchung_ids: offen },
    "buchung",
    null,
  );
  return {
    ok: true,
    zusammenfassung: `${aktualisiert} Buchung(en) als manuell bestaetigt markiert.`,
    aktualisiert,
    audit_eintrag_id: auditId,
    ausgefuehrt_am: jetzt(),
  };
}

async function fuehre_lege_lernregel_an(
  supabase: SupabaseClient,
  ownerId: string,
  aktion: AktionRow,
): Promise<AusfuehrErgebnis> {
  const p = aktion.parameter as {
    bezeichnung: string;
    bedingung: Record<string, unknown>;
    aktion: Record<string, unknown>;
    prioritaet?: number;
  };
  const { data: neu, error } = await supabase
    .from("lernregel")
    .insert({
      owner_id: ownerId,
      bezeichnung: p.bezeichnung,
      bedingung: p.bedingung,
      aktion: p.aktion,
      prioritaet: p.prioritaet ?? 100,
      aktiv: true,
    })
    .select("id, bezeichnung")
    .single();
  if (error || !neu) {
    return {
      ok: false,
      code: "db_error",
      message: error?.message ?? "Lernregel konnte nicht angelegt werden.",
      status: 500,
    };
  }
  const auditId = await schreibeAudit(
    supabase,
    ownerId,
    aktion,
    { lernregel: neu },
    "lernregel",
    neu.id,
  );
  return {
    ok: true,
    zusammenfassung: `Lernregel "${neu.bezeichnung}" wurde angelegt.`,
    aktualisiert: 1,
    audit_eintrag_id: auditId,
    ausgefuehrt_am: jetzt(),
  };
}

async function fuehre_aendere_lernregel(
  supabase: SupabaseClient,
  ownerId: string,
  aktion: AktionRow,
): Promise<AusfuehrErgebnis> {
  const p = aktion.parameter as {
    regel_id: string;
    bezeichnung?: string;
    bedingung?: Record<string, unknown>;
    aktion?: Record<string, unknown>;
    prioritaet?: number;
    aktiv?: boolean;
  };
  const updates: Record<string, unknown> = {};
  if (p.bezeichnung !== undefined) updates.bezeichnung = p.bezeichnung;
  if (p.bedingung !== undefined) updates.bedingung = p.bedingung;
  if (p.aktion !== undefined) updates.aktion = p.aktion;
  if (p.prioritaet !== undefined) updates.prioritaet = p.prioritaet;
  if (p.aktiv !== undefined) updates.aktiv = p.aktiv;

  const { data: vorher } = await supabase
    .from("lernregel")
    .select("id, bezeichnung")
    .eq("owner_id", ownerId)
    .eq("id", p.regel_id)
    .maybeSingle();
  if (!vorher) {
    return {
      ok: false,
      code: "not_found",
      message: "Lernregel existiert nicht (mehr).",
      status: 404,
    };
  }

  const { error } = await supabase
    .from("lernregel")
    .update(updates)
    .eq("owner_id", ownerId)
    .eq("id", p.regel_id);
  if (error) {
    return { ok: false, code: "db_error", message: error.message, status: 500 };
  }
  const auditId = await schreibeAudit(
    supabase,
    ownerId,
    aktion,
    { updates, regel: vorher },
    "lernregel",
    p.regel_id,
  );
  return {
    ok: true,
    zusammenfassung: `Lernregel "${vorher.bezeichnung}" wurde aktualisiert.`,
    aktualisiert: 1,
    audit_eintrag_id: auditId,
    ausgefuehrt_am: jetzt(),
  };
}

async function fuehre_loesche_lernregel(
  supabase: SupabaseClient,
  ownerId: string,
  aktion: AktionRow,
): Promise<AusfuehrErgebnis> {
  const p = aktion.parameter as { regel_id: string };
  const { data: vorher } = await supabase
    .from("lernregel")
    .select("id, bezeichnung")
    .eq("owner_id", ownerId)
    .eq("id", p.regel_id)
    .maybeSingle();
  if (!vorher) {
    return {
      ok: false,
      code: "not_found",
      message: "Lernregel existiert nicht (mehr).",
      status: 404,
    };
  }
  const { error } = await supabase
    .from("lernregel")
    .delete()
    .eq("owner_id", ownerId)
    .eq("id", p.regel_id);
  if (error) {
    return { ok: false, code: "db_error", message: error.message, status: 500 };
  }
  const auditId = await schreibeAudit(
    supabase,
    ownerId,
    aktion,
    { regel: vorher },
    "lernregel",
    p.regel_id,
  );
  return {
    ok: true,
    zusammenfassung: `Lernregel "${vorher.bezeichnung}" wurde geloescht.`,
    aktualisiert: 1,
    audit_eintrag_id: auditId,
    ausgefuehrt_am: jetzt(),
  };
}

async function fuehre_setze_empfaenger_kenntnis(
  supabase: SupabaseClient,
  ownerId: string,
  aktion: AktionRow,
): Promise<AusfuehrErgebnis> {
  const p = aktion.parameter as {
    empfaenger_norm: string;
    branche?: string;
    leistung?: string;
    klassifikation_default?: Klassifikation;
  };
  const norm = p.empfaenger_norm.trim();
  if (!norm) {
    return {
      ok: false,
      code: "validation",
      message: "empfaenger_norm darf nicht leer sein.",
      status: 422,
    };
  }
  const row = {
    owner_id: ownerId,
    empfaenger_norm: norm,
    branche: p.branche ?? null,
    leistung: p.leistung ?? null,
    quelle: "manuell" as const,
    recherche_versucht: true,
    ttl_tage: 36500,
    cached_at: jetzt(),
    letzte_klassifikation_default: p.klassifikation_default
      ? {
          klassifikation: p.klassifikation_default,
          steuerrelevant: p.klassifikation_default === "geschaeftlich",
          kategorie_id: null,
          ust_satz: null,
          konfidenz: 1,
        }
      : null,
  };
  const { error } = await supabase
    .from("empfaenger_kenntnis")
    .upsert(row, { onConflict: "owner_id,empfaenger_norm" });
  if (error) {
    return { ok: false, code: "db_error", message: error.message, status: 500 };
  }
  const auditId = await schreibeAudit(
    supabase,
    ownerId,
    aktion,
    { row },
    "empfaenger_kenntnis",
    null,
  );
  return {
    ok: true,
    zusammenfassung: `Empfaenger-Kenntnis "${norm}" wurde gesetzt (quelle=manuell).`,
    aktualisiert: 1,
    audit_eintrag_id: auditId,
    ausgefuehrt_am: jetzt(),
  };
}

async function fuehre_loesche_empfaenger_kenntnis(
  supabase: SupabaseClient,
  ownerId: string,
  aktion: AktionRow,
): Promise<AusfuehrErgebnis> {
  const p = aktion.parameter as { empfaenger_norm: string };
  const { error } = await supabase
    .from("empfaenger_kenntnis")
    .delete()
    .eq("owner_id", ownerId)
    .eq("empfaenger_norm", p.empfaenger_norm);
  if (error) {
    return { ok: false, code: "db_error", message: error.message, status: 500 };
  }
  const auditId = await schreibeAudit(
    supabase,
    ownerId,
    aktion,
    { empfaenger_norm: p.empfaenger_norm },
    "empfaenger_kenntnis",
    null,
  );
  return {
    ok: true,
    zusammenfassung: `Empfaenger-Cache fuer "${p.empfaenger_norm}" wurde geloescht.`,
    aktualisiert: 1,
    audit_eintrag_id: auditId,
    ausgefuehrt_am: jetzt(),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fuehrt einen bestaetigten Aktions-Vorschlag aus. Idempotent, owner-scoped,
 * mit Lost-Update-Schutz und Audit-Eintrag.
 */
export async function fuehreAktionAus(
  supabase: SupabaseClient,
  ownerId: string,
  aktion_id: string,
): Promise<AusfuehrErgebnis> {
  const aktion = await ladeAktion(supabase, ownerId, aktion_id);
  if (!aktion) {
    return {
      ok: false,
      code: "not_found",
      message: "Aktion nicht gefunden.",
      status: 404,
    };
  }
  if (aktion.owner_id !== ownerId) {
    return {
      ok: false,
      code: "forbidden",
      message: "Zugriff verweigert.",
      status: 404,
    };
  }
  if (aktion.status === "confirmed") {
    return {
      ok: false,
      code: "conflict",
      message: "Aktion wurde bereits bestaetigt.",
      status: 409,
    };
  }
  if (aktion.status === "cancelled") {
    return {
      ok: false,
      code: "conflict",
      message: "Aktion wurde abgebrochen.",
      status: 409,
    };
  }
  if (!istSchreibToolName(aktion.aktion)) {
    return {
      ok: false,
      code: "validation",
      message: `Unbekanntes Tool "${aktion.aktion}".`,
      status: 422,
    };
  }

  // Dispatch.
  let ergebnis: AusfuehrErgebnis;
  switch (aktion.aktion as SchreibToolName) {
    case "lege_kategorie_an":
      ergebnis = await fuehre_lege_kategorie_an(supabase, ownerId, aktion);
      break;
    case "aendere_kategorie":
      ergebnis = await fuehre_aendere_kategorie(supabase, ownerId, aktion);
      break;
    case "loesche_kategorie":
      ergebnis = await fuehre_loesche_kategorie(supabase, ownerId, aktion);
      break;
    case "bucheBuchungenUm":
      ergebnis = await fuehre_bucheBuchungenUm(supabase, ownerId, aktion);
      break;
    case "manuell_bestaetige_buchungen":
      ergebnis = await fuehre_manuell_bestaetige_buchungen(
        supabase,
        ownerId,
        aktion,
      );
      break;
    case "lege_lernregel_an":
      ergebnis = await fuehre_lege_lernregel_an(supabase, ownerId, aktion);
      break;
    case "aendere_lernregel":
      ergebnis = await fuehre_aendere_lernregel(supabase, ownerId, aktion);
      break;
    case "loesche_lernregel":
      ergebnis = await fuehre_loesche_lernregel(supabase, ownerId, aktion);
      break;
    case "setze_empfaenger_kenntnis":
      ergebnis = await fuehre_setze_empfaenger_kenntnis(
        supabase,
        ownerId,
        aktion,
      );
      break;
    case "loesche_empfaenger_kenntnis":
      ergebnis = await fuehre_loesche_empfaenger_kenntnis(
        supabase,
        ownerId,
        aktion,
      );
      break;
  }

  if (ergebnis.ok) {
    await setzeStatus(supabase, aktion_id, {
      status: "confirmed",
      audit_eintrag_id: ergebnis.audit_eintrag_id,
      fehler_text: null,
    });
    // Bestaetigungsnachricht in den Chat als Assistant-Eintrag schreiben.
    await supabase.from("chat_nachricht").insert({
      owner_id: ownerId,
      konversation_id: aktion.konversation_id,
      rolle: "assistant",
      inhalt: `Erledigt: ${ergebnis.zusammenfassung}`,
    });
    // updated_at der Konversation anfassen, damit sie in der Sidebar nach
    // oben rutscht.
    await supabase
      .from("chat_konversation")
      .update({ updated_at: jetzt() })
      .eq("owner_id", ownerId)
      .eq("id", aktion.konversation_id);
  } else {
    await setzeStatus(supabase, aktion_id, {
      status: "error",
      fehler_text: ergebnis.message,
    });
  }
  return ergebnis;
}

/**
 * Bricht einen Aktions-Vorschlag ab. Idempotent — wenn bereits cancelled,
 * Erfolg. Bereits confirmed → Konflikt.
 */
export async function brecheAktionAb(
  supabase: SupabaseClient,
  ownerId: string,
  aktion_id: string,
): Promise<AusfuehrErgebnis> {
  const aktion = await ladeAktion(supabase, ownerId, aktion_id);
  if (!aktion) {
    return {
      ok: false,
      code: "not_found",
      message: "Aktion nicht gefunden.",
      status: 404,
    };
  }
  if (aktion.status === "confirmed") {
    return {
      ok: false,
      code: "conflict",
      message: "Aktion ist bereits bestaetigt und kann nicht mehr abgebrochen werden.",
      status: 409,
    };
  }
  if (aktion.status === "cancelled") {
    return {
      ok: true,
      zusammenfassung: "Bereits abgebrochen.",
      aktualisiert: 0,
      audit_eintrag_id: null,
      ausgefuehrt_am: jetzt(),
    };
  }
  await setzeStatus(supabase, aktion_id, {
    status: "cancelled",
    fehler_text: null,
  });
  return {
    ok: true,
    zusammenfassung: "Vorschlag abgebrochen.",
    aktualisiert: 0,
    audit_eintrag_id: null,
    ausgefuehrt_am: jetzt(),
  };
}
