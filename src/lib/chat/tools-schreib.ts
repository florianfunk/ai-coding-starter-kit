// PROJ-17 — Schreib-Tools fuer den KI-Chat (Confirm-Flow).
//
// WICHTIG: Schreib-Tools fuehren NIE direkt eine DB-Mutation aus. Sie:
//   1) Validieren die Parameter (Zod + fachliche Konsistenz, z. B.
//      "existiert die Kategorie?", "gehoeren die Buchungen dem Owner?").
//   2) Berechnen eine Vorschau (Klartext + optionale Vorher/Nachher-Tabelle).
//   3) Legen einen `chat_aktion`-Eintrag mit `status='pending_confirm'` an.
//   4) Liefern dem LLM `{aktion_id, vorschau, parameter, vorher_nachher}`
//      zurueck — damit weiss das LLM: "Ich habe einen Vorschlag erzeugt,
//      NICHT ausgefuehrt." und kann das dem Nutzer korrekt erklaeren.
//
// Die eigentliche Ausfuehrung passiert erst, wenn der Nutzer im UI
// "Bestaetigen" klickt → POST /api/chat/[konv]/aktion/[id]/bestaetigen →
// `fuehreAktionAus()` aus aktion-ausfuehren.ts.
//
// FIXE ALLOWLIST: 10 Tools. Was nicht hier steht, kann das LLM nicht.
// Insbesondere NICHT in der Allowlist (siehe Spec):
//   - Konten anlegen/aendern/loeschen
//   - Profil-Daten aendern (Arbeitgeber/Familie/Adresse)
//   - Importe rueckgaengig machen / Buchungen loeschen
//   - Steuerperioden abschliessen / Exporte starten
//   - DSGVO-Daten / Audit-Spur loeschen

import { tool } from "ai";
import { z } from "zod";
import type { ChatToolContext } from "./tool-context";
import { werkzeugFehler } from "./fehler";
import type {
  BuchungStatus,
  Klassifikation,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Gemeinsame Hilfen
// ---------------------------------------------------------------------------

function formatBetrag(n: number): string {
  const abs = Math.abs(n);
  const s = abs.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${n < 0 ? "-" : ""}${s} €`;
}

function formatDatum(iso: string): string {
  // "2026-05-21" -> "21.05.2026"
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

/** Legt einen chat_aktion-Eintrag an und liefert das Ergebnis fuer das LLM. */
async function legeVorschlagAn(
  ctx: ChatToolContext,
  aktion: string,
  parameter: Record<string, unknown>,
  vorschau: string,
  vorher_nachher: unknown = null,
): Promise<
  | {
      aktion_id: string;
      status: "pending_confirm";
      vorschau: string;
      hinweis: string;
    }
  | { fehler: string }
> {
  if (!ctx.nachrichtIdRef.current) {
    // Defensive: Schreib-Tool wurde aufgerufen, bevor die Assistant-Nachricht
    // in der DB lag. Das ist ein interner Bug im Stream-Wiring.
    return {
      fehler:
        "Interner Fehler: nachricht_id noch nicht gesetzt. Schreib-Tools koennen erst nach Assistant-Nachricht-Anlage aufgerufen werden.",
    };
  }
  const { supabase, ownerId, konversationId, nachrichtIdRef } = ctx;
  const { data, error } = await supabase
    .from("chat_aktion")
    .insert({
      owner_id: ownerId,
      konversation_id: konversationId,
      nachricht_id: nachrichtIdRef.current,
      aktion,
      parameter,
      vorschau,
      vorher_nachher,
      status: "pending_confirm",
    })
    .select("id")
    .single();
  if (error || !data) {
    return werkzeugFehler(
      aktion,
      error,
      "Der Vorschlag konnte nicht gespeichert werden. Bitte später erneut versuchen.",
    );
  }
  return {
    aktion_id: data.id as string,
    status: "pending_confirm",
    vorschau,
    hinweis:
      "Der Vorschlag wurde zur Bestaetigung im Chat angezeigt. Erkläre dem Nutzer kurz, was du vorgeschlagen hast, und bitte um Bestaetigung in der Aktions-Karte.",
  };
}

// ---------------------------------------------------------------------------
// 1) lege_kategorie_an
// ---------------------------------------------------------------------------

const legeKategorieAnInput = z.object({
  bezeichnung: z.string().min(2).max(120),
  typ: z.enum(["einnahme", "ausgabe", "privat", "neutral"]),
  ust_satz: z
    .union([z.literal(0), z.literal(7), z.literal(19)])
    .nullable()
    .optional()
    .describe("Bei privat/neutral null."),
  steuerrelevant: z
    .boolean()
    .optional()
    .describe(
      "Default: true bei einnahme/ausgabe, false bei privat/neutral. Wird ignoriert, wenn nicht passend zum Typ.",
    ),
  euer_zeile: z.string().max(40).optional(),
});

export function legeKategorieAnTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Schlaegt das Anlegen einer neuen Kategorie im EÜR-Kontenrahmen vor. Erst nach Nutzer-Bestaetigung wird sie wirklich angelegt.",
    inputSchema: legeKategorieAnInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      // Doppelte Bezeichnung pruefen.
      const { data: existing } = await supabase
        .from("kategorie")
        .select("id")
        .eq("owner_id", ownerId)
        .eq("bezeichnung", input.bezeichnung)
        .maybeSingle();
      if (existing) {
        return {
          fehler: `Es gibt bereits eine Kategorie mit der Bezeichnung "${input.bezeichnung}".`,
        };
      }

      const vorschau = `Neue Kategorie wird angelegt: "${input.bezeichnung}" (Typ: ${input.typ}${
        input.ust_satz === null || input.ust_satz === undefined
          ? ""
          : `, USt ${input.ust_satz}%`
      }).`;

      return await legeVorschlagAn(
        ctx,
        "lege_kategorie_an",
        { ...input },
        vorschau,
      );
    },
  });
}

// ---------------------------------------------------------------------------
// 2) aendere_kategorie
// ---------------------------------------------------------------------------

const aendereKategorieInput = z
  .object({
    kategorie_id: z.uuid(),
    bezeichnung: z.string().min(2).max(120).optional(),
    typ: z.enum(["einnahme", "ausgabe", "privat", "neutral"]).optional(),
    ust_satz: z
      .union([z.literal(0), z.literal(7), z.literal(19), z.null()])
      .optional(),
    aktiv: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.bezeichnung !== undefined ||
      d.typ !== undefined ||
      d.ust_satz !== undefined ||
      d.aktiv !== undefined,
    { message: "Mindestens ein Feld zum Aendern muss angegeben werden." },
  );

export function aendereKategorieTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Schlaegt eine Aenderung einer bestehenden Kategorie vor (Bezeichnung, Typ, USt-Satz, aktiv-Status). Zeigt Vorher/Nachher.",
    inputSchema: aendereKategorieInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const { data: vorher, error } = await supabase
        .from("kategorie")
        .select("id, bezeichnung, typ, ust_satz, aktiv")
        .eq("owner_id", ownerId)
        .eq("id", input.kategorie_id)
        .maybeSingle();
      if (error) return werkzeugFehler("aendere_kategorie", error);
      if (!vorher) return { fehler: "Kategorie nicht gefunden." };

      const aenderungen: string[] = [];
      if (input.bezeichnung && input.bezeichnung !== vorher.bezeichnung) {
        aenderungen.push(
          `Bezeichnung: "${vorher.bezeichnung}" → "${input.bezeichnung}"`,
        );
      }
      if (input.typ && input.typ !== vorher.typ) {
        aenderungen.push(`Typ: ${vorher.typ} → ${input.typ}`);
      }
      if (input.ust_satz !== undefined && input.ust_satz !== vorher.ust_satz) {
        aenderungen.push(
          `USt-Satz: ${vorher.ust_satz ?? "—"} → ${input.ust_satz ?? "—"}`,
        );
      }
      if (input.aktiv !== undefined && input.aktiv !== vorher.aktiv) {
        aenderungen.push(`Aktiv: ${vorher.aktiv} → ${input.aktiv}`);
      }
      if (aenderungen.length === 0) {
        return { fehler: "Keine wirklichen Aenderungen — Werte sind identisch." };
      }

      const vorschau = `Kategorie "${vorher.bezeichnung}" wird geaendert: ${aenderungen.join("; ")}.`;

      return await legeVorschlagAn(
        ctx,
        "aendere_kategorie",
        { ...input },
        vorschau,
        { vorher, neu: input },
      );
    },
  });
}

// ---------------------------------------------------------------------------
// 3) loesche_kategorie
// ---------------------------------------------------------------------------

const loescheKategorieInput = z.object({
  kategorie_id: z.uuid(),
});

export function loescheKategorieTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Schlaegt das Loeschen einer Kategorie vor. Zeigt im Vorschlag die Anzahl der betroffenen Buchungen, die danach ohne Kategorie sind (kategorie_id → null).",
    inputSchema: loescheKategorieInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const { data: kat, error } = await supabase
        .from("kategorie")
        .select("id, bezeichnung, typ")
        .eq("owner_id", ownerId)
        .eq("id", input.kategorie_id)
        .maybeSingle();
      if (error) return werkzeugFehler("loesche_kategorie", error);
      if (!kat) return { fehler: "Kategorie nicht gefunden." };

      const { count } = await supabase
        .from("buchung")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId)
        .eq("kategorie_id", input.kategorie_id);

      const betroffen = count ?? 0;
      const vorschau = `Kategorie "${kat.bezeichnung}" wird geloescht. ${betroffen} Buchung(en) verlieren ihre Zuordnung (kategorie_id → null) und kehren ggf. in die Pruefliste zurueck.`;

      return await legeVorschlagAn(
        ctx,
        "loesche_kategorie",
        { ...input },
        vorschau,
        { betroffene_buchungen: betroffen, kategorie: kat },
      );
    },
  });
}

// ---------------------------------------------------------------------------
// 4) bucheBuchungenUm
// ---------------------------------------------------------------------------

const buchungenUmbuchenInput = z.object({
  buchung_ids: z
    .array(z.uuid())
    .min(1)
    .max(100)
    .describe("IDs der umzubuchenden Buchungen (max 100)."),
  neue_kategorie_id: z.uuid().describe("Ziel-Kategorie-ID."),
  neue_klassifikation: z
    .enum(["privat", "geschaeftlich", "unklar", "neutral"])
    .optional()
    .describe(
      "Optional. Wenn nicht gesetzt, wird sie aus dem Kategorie-Typ abgeleitet.",
    ),
});

export function bucheBuchungenUmTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Schlaegt vor, mehrere Buchungen einer neuen Kategorie zuzuordnen (Umbuchung). Zeigt eine Vorher/Nachher-Tabelle.",
    inputSchema: buchungenUmbuchenInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const { data: kat, error: katErr } = await supabase
        .from("kategorie")
        .select("id, bezeichnung, typ, ust_satz")
        .eq("owner_id", ownerId)
        .eq("id", input.neue_kategorie_id)
        .maybeSingle();
      if (katErr) return werkzeugFehler("bucheBuchungenUm", katErr);
      if (!kat) return { fehler: "Ziel-Kategorie nicht gefunden." };

      const { data: rows, error: bErr } = await supabase
        .from("buchung")
        .select(
          "id, buchung_datum, empfaenger, betrag, kategorie_id, status, klassifikation, kategorie:kategorie(bezeichnung)",
        )
        .eq("owner_id", ownerId)
        .in("id", input.buchung_ids);
      if (bErr) return werkzeugFehler("bucheBuchungenUm", bErr);

      type Row = {
        id: string;
        buchung_datum: string;
        empfaenger: string | null;
        betrag: number;
        kategorie_id: string | null;
        status: BuchungStatus;
        klassifikation: Klassifikation | null;
        kategorie:
          | { bezeichnung: string }
          | Array<{ bezeichnung: string }>
          | null;
      };
      const liste = (rows ?? []) as Row[];
      const gefundene = new Set(liste.map((r) => r.id));
      const fehlende = input.buchung_ids.filter((id) => !gefundene.has(id));

      const vorher_nachher = liste.map((r) => {
        const k = Array.isArray(r.kategorie) ? r.kategorie[0] : r.kategorie;
        return {
          id: r.id,
          datum: formatDatum(r.buchung_datum),
          empfaenger: r.empfaenger ?? "—",
          betrag: formatBetrag(Number(r.betrag) || 0),
          vorher: k?.bezeichnung ?? "— ohne Kategorie —",
          nachher: kat.bezeichnung,
        };
      });

      const vorschau =
        `${liste.length} Buchung(en) werden auf Kategorie "${kat.bezeichnung}" umgebucht.` +
        (fehlende.length > 0
          ? ` ${fehlende.length} ID(s) wurden nicht gefunden und werden uebersprungen.`
          : "") +
        ` Status wird auf "manuell_bestaetigt" gesetzt — die Re-Klassifizierung respektiert das.`;

      return await legeVorschlagAn(
        ctx,
        "bucheBuchungenUm",
        { ...input },
        vorschau,
        vorher_nachher,
      );
    },
  });
}

// ---------------------------------------------------------------------------
// 5) manuell_bestaetige_buchungen
// ---------------------------------------------------------------------------

const manuellBestaetigeBuchungenInput = z.object({
  buchung_ids: z.array(z.uuid()).min(1).max(100),
});

export function manuellBestaetigeBuchungenTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Schlaegt vor, Buchungen als 'manuell_bestaetigt' zu markieren — die Klassifizierungs-Pipeline laesst sie danach in Ruhe.",
    inputSchema: manuellBestaetigeBuchungenInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const { data: rows, error } = await supabase
        .from("buchung")
        .select("id, buchung_datum, empfaenger, betrag, status")
        .eq("owner_id", ownerId)
        .in("id", input.buchung_ids);
      if (error) return werkzeugFehler("manuell_bestaetige_buchungen", error);

      type Row = {
        id: string;
        buchung_datum: string;
        empfaenger: string | null;
        betrag: number;
        status: BuchungStatus;
      };
      const liste = (rows ?? []) as Row[];
      const bereits = liste.filter((r) => r.status === "manuell_bestaetigt").length;

      const vorschau =
        `${liste.length} Buchung(en) werden auf Status "manuell_bestaetigt" gesetzt.` +
        (bereits > 0
          ? ` ${bereits} davon sind bereits bestaetigt — die werden uebersprungen.`
          : "");

      const vorher_nachher = liste.slice(0, 50).map((r) => ({
        id: r.id,
        datum: formatDatum(r.buchung_datum),
        empfaenger: r.empfaenger ?? "—",
        betrag: formatBetrag(Number(r.betrag) || 0),
        vorher: r.status,
        nachher: "manuell_bestaetigt",
      }));

      return await legeVorschlagAn(
        ctx,
        "manuell_bestaetige_buchungen",
        { ...input },
        vorschau,
        vorher_nachher,
      );
    },
  });
}

// ---------------------------------------------------------------------------
// 6) lege_lernregel_an
// ---------------------------------------------------------------------------

const legeLernregelAnInput = z
  .object({
    bezeichnung: z.string().min(2).max(120),
    bedingung: z.object({
      empfaenger_muster: z.string().min(1).max(120).optional(),
      zweck_muster: z.string().min(1).max(200).optional(),
      konto_id: z.uuid().optional(),
      betrag_min: z.number().optional(),
      betrag_max: z.number().optional(),
    }),
    aktion: z.object({
      kategorie_id: z.uuid().optional(),
      klassifikation: z
        .enum(["privat", "geschaeftlich", "unklar", "neutral"])
        .optional(),
      ust_satz: z
        .union([z.literal(0), z.literal(7), z.literal(19)])
        .optional(),
    }),
    prioritaet: z.number().int().min(0).max(1000).default(100),
  })
  .refine(
    (d) =>
      d.bedingung.empfaenger_muster !== undefined ||
      d.bedingung.zweck_muster !== undefined,
    {
      message:
        "Mindestens ein Bedingungs-Muster (Empfaenger oder Zweck) ist Pflicht.",
    },
  )
  .refine(
    (d) =>
      d.aktion.kategorie_id !== undefined ||
      d.aktion.klassifikation !== undefined ||
      d.aktion.ust_satz !== undefined,
    {
      message: "Mindestens ein Aktions-Feld muss gesetzt sein.",
    },
  );

export function legeLernregelAnTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Schlaegt das Anlegen einer Lernregel vor. Berechnet die prognostizierte Wirkung: wieviele bestehende Buchungen wuerde die Regel rueckwirkend treffen.",
    inputSchema: legeLernregelAnInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;

      // Prognose: wieviele Bestands-Buchungen wuerde die Regel treffen?
      // Wir matchen owner-scoped + empfaenger_muster ILIKE + zweck_muster ILIKE.
      let q = supabase
        .from("buchung")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId);
      if (input.bedingung.empfaenger_muster) {
        q = q.ilike("empfaenger", `%${input.bedingung.empfaenger_muster}%`);
      }
      if (input.bedingung.zweck_muster) {
        q = q.ilike("verwendungszweck", `%${input.bedingung.zweck_muster}%`);
      }
      if (input.bedingung.konto_id) {
        q = q.eq("konto_id", input.bedingung.konto_id);
      }
      if (typeof input.bedingung.betrag_min === "number") {
        q = q.gte("betrag", input.bedingung.betrag_min);
      }
      if (typeof input.bedingung.betrag_max === "number") {
        q = q.lte("betrag", input.bedingung.betrag_max);
      }
      const { count } = await q;

      const vorschau = `Lernregel "${input.bezeichnung}" wird angelegt. Sie wuerde aktuell ${count ?? 0} Bestands-Buchung(en) treffen.`;

      return await legeVorschlagAn(
        ctx,
        "lege_lernregel_an",
        { ...input },
        vorschau,
        { prognose_treffer: count ?? 0 },
      );
    },
  });
}

// ---------------------------------------------------------------------------
// 7) aendere_lernregel
// ---------------------------------------------------------------------------

const aendereLernregelInput = z
  .object({
    regel_id: z.uuid(),
    bezeichnung: z.string().min(2).max(120).optional(),
    bedingung: z
      .object({
        empfaenger_muster: z.string().min(1).max(120).optional(),
        zweck_muster: z.string().min(1).max(200).optional(),
        konto_id: z.uuid().optional(),
        betrag_min: z.number().optional(),
        betrag_max: z.number().optional(),
      })
      .optional(),
    aktion: z
      .object({
        kategorie_id: z.uuid().optional(),
        klassifikation: z
          .enum(["privat", "geschaeftlich", "unklar", "neutral"])
          .optional(),
        ust_satz: z
          .union([z.literal(0), z.literal(7), z.literal(19)])
          .optional(),
      })
      .optional(),
    prioritaet: z.number().int().min(0).max(1000).optional(),
    aktiv: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.bezeichnung !== undefined ||
      d.bedingung !== undefined ||
      d.aktion !== undefined ||
      d.prioritaet !== undefined ||
      d.aktiv !== undefined,
    { message: "Mindestens ein Feld zum Aendern angeben." },
  );

export function aendereLernregelTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Schlaegt eine Aenderung an einer bestehenden Lernregel vor (Bezeichnung, Bedingung, Aktion, Prioritaet, Aktiv-Status).",
    inputSchema: aendereLernregelInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const { data: vorher, error } = await supabase
        .from("lernregel")
        .select("id, bezeichnung, bedingung, aktion, prioritaet, aktiv")
        .eq("owner_id", ownerId)
        .eq("id", input.regel_id)
        .maybeSingle();
      if (error) return werkzeugFehler("aendere_lernregel", error);
      if (!vorher) return { fehler: "Lernregel nicht gefunden." };

      const vorschau = `Lernregel "${vorher.bezeichnung}" wird geaendert.`;

      return await legeVorschlagAn(
        ctx,
        "aendere_lernregel",
        { ...input },
        vorschau,
        { vorher, neu: input },
      );
    },
  });
}

// ---------------------------------------------------------------------------
// 8) loesche_lernregel
// ---------------------------------------------------------------------------

const loescheLernregelInput = z.object({
  regel_id: z.uuid(),
});

export function loescheLernregelTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Schlaegt das Loeschen einer Lernregel vor. Bestehende Buchungen bleiben unveraendert; die Regel greift kuenftig nicht mehr.",
    inputSchema: loescheLernregelInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const { data: vorher, error } = await supabase
        .from("lernregel")
        .select("id, bezeichnung, treffer_zaehler, aktiv")
        .eq("owner_id", ownerId)
        .eq("id", input.regel_id)
        .maybeSingle();
      if (error) return werkzeugFehler("loesche_lernregel", error);
      if (!vorher) return { fehler: "Lernregel nicht gefunden." };

      const vorschau = `Lernregel "${vorher.bezeichnung}" wird geloescht (bisheriger Treffer-Zaehler: ${vorher.treffer_zaehler}).`;

      return await legeVorschlagAn(
        ctx,
        "loesche_lernregel",
        { ...input },
        vorschau,
        { vorher },
      );
    },
  });
}

// ---------------------------------------------------------------------------
// 9) setze_empfaenger_kenntnis
// ---------------------------------------------------------------------------

const setzeEmpfaengerKenntnisInput = z.object({
  empfaenger_norm: z.string().min(1).max(120),
  branche: z.string().min(1).max(120).optional(),
  leistung: z.string().min(1).max(200).optional(),
  klassifikation_default: z
    .enum(["privat", "geschaeftlich", "unklar", "neutral"])
    .optional(),
});

export function setzeEmpfaengerKenntnisTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Schlaegt vor, fuer einen Empfaenger den Cache-Eintrag (Branche, Leistung, Klassifikations-Default) manuell zu setzen oder zu ueberschreiben. Quelle: 'manuell' (faktisch unbegrenzte TTL).",
    inputSchema: setzeEmpfaengerKenntnisInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const { data: vorher } = await supabase
        .from("empfaenger_kenntnis")
        .select("empfaenger_norm, branche, leistung, quelle")
        .eq("owner_id", ownerId)
        .eq("empfaenger_norm", input.empfaenger_norm)
        .maybeSingle();

      const vorschau = vorher
        ? `Empfaenger-Cache fuer "${input.empfaenger_norm}" wird aktualisiert (quelle=manuell).`
        : `Empfaenger-Cache fuer "${input.empfaenger_norm}" wird neu angelegt (quelle=manuell).`;

      return await legeVorschlagAn(
        ctx,
        "setze_empfaenger_kenntnis",
        { ...input },
        vorschau,
        { vorher, neu: input },
      );
    },
  });
}

// ---------------------------------------------------------------------------
// 10) loesche_empfaenger_kenntnis
// ---------------------------------------------------------------------------

const loescheEmpfaengerKenntnisInput = z.object({
  empfaenger_norm: z.string().min(1).max(120),
});

export function loescheEmpfaengerKenntnisTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Schlaegt vor, den Empfaenger-Cache-Eintrag zu loeschen. Beim naechsten Vorkommen wird der Empfaenger neu recherchiert.",
    inputSchema: loescheEmpfaengerKenntnisInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const { data: vorher } = await supabase
        .from("empfaenger_kenntnis")
        .select("empfaenger_norm, branche, leistung, quelle")
        .eq("owner_id", ownerId)
        .eq("empfaenger_norm", input.empfaenger_norm)
        .maybeSingle();
      if (!vorher) return { fehler: "Kein Cache-Eintrag mit diesem Schluessel." };

      const vorschau = `Empfaenger-Cache fuer "${input.empfaenger_norm}" wird geloescht. Beim naechsten Vorkommen wird neu recherchiert.`;

      return await legeVorschlagAn(
        ctx,
        "loesche_empfaenger_kenntnis",
        { ...input },
        vorschau,
        { vorher },
      );
    },
  });
}

// ---------------------------------------------------------------------------
// Sammelfunktion
// ---------------------------------------------------------------------------

export function baueSchreibTools(ctx: ChatToolContext) {
  return {
    lege_kategorie_an: legeKategorieAnTool(ctx),
    aendere_kategorie: aendereKategorieTool(ctx),
    loesche_kategorie: loescheKategorieTool(ctx),
    bucheBuchungenUm: bucheBuchungenUmTool(ctx),
    manuell_bestaetige_buchungen: manuellBestaetigeBuchungenTool(ctx),
    lege_lernregel_an: legeLernregelAnTool(ctx),
    aendere_lernregel: aendereLernregelTool(ctx),
    loesche_lernregel: loescheLernregelTool(ctx),
    setze_empfaenger_kenntnis: setzeEmpfaengerKenntnisTool(ctx),
    loesche_empfaenger_kenntnis: loescheEmpfaengerKenntnisTool(ctx),
  };
}

// Re-export der erwarteten Tool-Namen-Konstanten — wird vom Aktions-Ausfuehrer
// als Typ-Garant referenziert.
export const SCHREIB_TOOL_NAMEN = [
  "lege_kategorie_an",
  "aendere_kategorie",
  "loesche_kategorie",
  "bucheBuchungenUm",
  "manuell_bestaetige_buchungen",
  "lege_lernregel_an",
  "aendere_lernregel",
  "loesche_lernregel",
  "setze_empfaenger_kenntnis",
  "loesche_empfaenger_kenntnis",
] as const;
export type SchreibToolName = (typeof SCHREIB_TOOL_NAMEN)[number];
