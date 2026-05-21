// PROJ-17 — Lese-Tools fuer den KI-Chat.
//
// Eine FIXE Allowlist von 11 Tools, die das LLM aufrufen darf, um Fragen
// des Inhabers zu beantworten. Alle Tools sind owner-scoped (RLS aktiv +
// expliziter owner_id-Filter als Defense-in-Depth).
//
// Konvention:
//  - description: Kurz, klar, auf Deutsch — das LLM liest das als Hinweis.
//  - inputSchema: Zod mit `.describe()` auf jedem Feld, damit das LLM die
//    Parameter sinnvoll fuellt.
//  - execute: nimmt validierte Eingabe + Context, gibt JSON-serialisierbares
//    Ergebnis zurueck. Bei Fehler: `{ fehler: '...' }` (kein Throw — das
//    LLM soll den Fehler-Text in seiner Antwort verarbeiten koennen).

import { tool } from "ai";
import { z } from "zod";
import type { ChatToolContext } from "./tool-context";
import { holeProfil, profilHatInhalt } from "@/lib/classifier/profil";
import {
  erkenneCluster,
  klassifiziereIntervall,
  modusEmpfaenger,
  MIN_BUCHUNGEN,
  MIN_LOOKBACK_TAGE,
  tageZwischen,
} from "@/lib/finanzen/wiederkehrend-erkennung";
import { normalisiereEmpfaenger } from "@/lib/classifier/normalize";
import type {
  BuchungStatus,
  KategorieTyp,
  Klassifikation,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Gemeinsame Hilfen
// ---------------------------------------------------------------------------

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

/** Datums-Schema mit Klartext-Hinweis fuer das LLM. */
const isoDate = z
  .string()
  .regex(isoDateRegex, "Datum als YYYY-MM-DD erwartet (z. B. 2026-05-21)");

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Liefert das heutige Datum als ISO YYYY-MM-DD (lokale Zeit). */
function isoHeute(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${t}`;
}

// ---------------------------------------------------------------------------
// 1) suche_buchungen — Filter-basierte Suche
// ---------------------------------------------------------------------------

const sucheBuchungenInput = z.object({
  zeitraum_von: isoDate
    .optional()
    .describe("Frühestes Buchungsdatum (inkl.)."),
  zeitraum_bis: isoDate.optional().describe("Spätestes Buchungsdatum (inkl.)."),
  empfaenger_kontakt: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe("Substring im Empfänger (case-insensitive)."),
  zweck_kontakt: z
    .string()
    .min(1)
    .max(200)
    .optional()
    .describe("Substring im Verwendungszweck (case-insensitive)."),
  kategorie_bezeichnung: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .describe(
      "Bezeichnung der Kategorie (z. B. 'Software / IT'). Substring-Match.",
    ),
  betrag_min: z
    .number()
    .optional()
    .describe("Minimaler Betrag (ohne Vorzeichen-Filter)."),
  betrag_max: z.number().optional().describe("Maximaler Betrag."),
  status: z
    .enum(["offen", "auto_verbucht", "zur_pruefung", "manuell_bestaetigt"])
    .optional()
    .describe("Buchungs-Status."),
  richtung: z
    .enum(["einnahme", "ausgabe"])
    .optional()
    .describe(
      "Richtung: 'einnahme' = Betrag positiv, 'ausgabe' = Betrag negativ.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe("Maximale Trefferzahl (1-100)."),
});

export function sucheBuchungenTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Sucht Buchungen anhand von Filtern (Zeitraum, Empfänger, Zweck, Kategorie, Betrag, Status, Richtung). Liefert eine Liste mit Datum, Empfänger, Zweck, Betrag, Kategorie und Status.",
    inputSchema: sucheBuchungenInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      // Wir laden mit JOIN-Embedding auf kategorie (Bezeichnung + Typ).
      let q = supabase
        .from("buchung")
        .select(
          "id, buchung_datum, empfaenger, verwendungszweck, betrag, status, klassifikation, konfidenz, kategorie_id, kategorie:kategorie(id, bezeichnung, typ)",
        )
        .eq("owner_id", ownerId)
        .order("buchung_datum", { ascending: false })
        .limit(input.limit);

      if (input.zeitraum_von) q = q.gte("buchung_datum", input.zeitraum_von);
      if (input.zeitraum_bis) q = q.lte("buchung_datum", input.zeitraum_bis);
      if (input.empfaenger_kontakt) {
        q = q.ilike("empfaenger", `%${input.empfaenger_kontakt}%`);
      }
      if (input.zweck_kontakt) {
        q = q.ilike("verwendungszweck", `%${input.zweck_kontakt}%`);
      }
      if (input.status) q = q.eq("status", input.status);
      if (input.richtung === "einnahme") q = q.gt("betrag", 0);
      if (input.richtung === "ausgabe") q = q.lt("betrag", 0);
      if (typeof input.betrag_min === "number") {
        q = q.gte("betrag", input.betrag_min);
      }
      if (typeof input.betrag_max === "number") {
        q = q.lte("betrag", input.betrag_max);
      }

      const { data, error } = await q;
      if (error) {
        return { fehler: `Suche fehlgeschlagen: ${error.message}` };
      }

      type Row = {
        id: string;
        buchung_datum: string;
        empfaenger: string | null;
        verwendungszweck: string | null;
        betrag: number;
        status: BuchungStatus;
        klassifikation: Klassifikation | null;
        konfidenz: number | null;
        kategorie_id: string | null;
        kategorie:
          | { id: string; bezeichnung: string; typ: KategorieTyp }
          | Array<{ id: string; bezeichnung: string; typ: KategorieTyp }>
          | null;
      };

      let rows = (data ?? []) as Row[];

      // Kategorie-Bezeichnung-Filter erst nach dem Load (Supabase erlaubt
      // ilike auf eingebettete Felder nur eingeschraenkt).
      if (input.kategorie_bezeichnung) {
        const needle = input.kategorie_bezeichnung.toLowerCase();
        rows = rows.filter((r) => {
          const k = Array.isArray(r.kategorie) ? r.kategorie[0] : r.kategorie;
          return k?.bezeichnung?.toLowerCase().includes(needle) ?? false;
        });
      }

      const buchungen = rows.map((r) => {
        const k = Array.isArray(r.kategorie) ? r.kategorie[0] : r.kategorie;
        return {
          id: r.id,
          datum: r.buchung_datum,
          empfaenger: r.empfaenger,
          verwendungszweck: r.verwendungszweck,
          betrag: Number(r.betrag) || 0,
          status: r.status,
          klassifikation: r.klassifikation,
          konfidenz: r.konfidenz === null ? null : Number(r.konfidenz),
          kategorie_id: r.kategorie_id,
          kategorie_bezeichnung: k?.bezeichnung ?? null,
          kategorie_typ: k?.typ ?? null,
        };
      });

      const summe = round2(buchungen.reduce((s, b) => s + b.betrag, 0));
      return {
        anzahl: buchungen.length,
        summe,
        buchungen,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// 2) aggregat_kategorien — Aggregat je Kategorie
// ---------------------------------------------------------------------------

const aggregatKategorienInput = z.object({
  zeitraum_von: isoDate.optional(),
  zeitraum_bis: isoDate.optional(),
  nur_steuerrelevant: z
    .boolean()
    .optional()
    .describe("Nur als steuerrelevant markierte Buchungen einbeziehen."),
});

export function aggregatKategorienTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Aggregiert alle Buchungen je Kategorie für einen Zeitraum: Anzahl, Summe, Durchschnitt, Ø-Konfidenz. Standard-Zeitraum: aktuelles Kalenderjahr.",
    inputSchema: aggregatKategorienInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const jetztJahr = new Date().getFullYear();
      const von = input.zeitraum_von ?? `${jetztJahr}-01-01`;
      const bis = input.zeitraum_bis ?? `${jetztJahr}-12-31`;

      let q = supabase
        .from("buchung")
        .select(
          "betrag, konfidenz, kategorie_id, klassifikation, steuerrelevant",
        )
        .eq("owner_id", ownerId)
        .gte("buchung_datum", von)
        .lte("buchung_datum", bis)
        .limit(20000);
      if (input.nur_steuerrelevant) q = q.eq("steuerrelevant", true);

      const [bRes, kRes] = await Promise.all([
        q,
        supabase
          .from("kategorie")
          .select("id, bezeichnung, typ, ust_satz, aktiv")
          .eq("owner_id", ownerId)
          .limit(1000),
      ]);

      if (bRes.error) {
        return { fehler: `Buchungen konnten nicht geladen werden: ${bRes.error.message}` };
      }
      if (kRes.error) {
        return { fehler: `Kategorien konnten nicht geladen werden: ${kRes.error.message}` };
      }

      type BuchungRow = {
        betrag: number;
        konfidenz: number | null;
        kategorie_id: string | null;
        klassifikation: Klassifikation | null;
        steuerrelevant: boolean | null;
      };
      type KatRow = {
        id: string;
        bezeichnung: string;
        typ: KategorieTyp;
        ust_satz: number | null;
        aktiv: boolean;
      };
      const buchungen = (bRes.data ?? []) as BuchungRow[];
      const kats = (kRes.data ?? []) as KatRow[];
      const katMap = new Map(kats.map((k) => [k.id, k]));

      const acc = new Map<
        string,
        {
          kategorie_id: string | null;
          bezeichnung: string;
          typ: KategorieTyp | "ohne";
          ust_satz: number | null;
          anzahl: number;
          summe: number;
          konfSum: number;
          konfN: number;
        }
      >();

      for (const b of buchungen) {
        const key = b.kategorie_id ?? "__ohne__";
        const k = b.kategorie_id ? katMap.get(b.kategorie_id) : undefined;
        const e =
          acc.get(key) ??
          {
            kategorie_id: b.kategorie_id ?? null,
            bezeichnung: k?.bezeichnung ?? "— ohne Kategorie —",
            typ: (k?.typ ?? "ohne") as KategorieTyp | "ohne",
            ust_satz: k?.ust_satz ?? null,
            anzahl: 0,
            summe: 0,
            konfSum: 0,
            konfN: 0,
          };
        e.anzahl++;
        e.summe += Number(b.betrag) || 0;
        if (b.konfidenz !== null) {
          e.konfSum += Number(b.konfidenz);
          e.konfN++;
        }
        acc.set(key, e);
      }

      const ergebnis = Array.from(acc.values())
        .map((e) => ({
          kategorie_id: e.kategorie_id,
          bezeichnung: e.bezeichnung,
          typ: e.typ,
          ust_satz: e.ust_satz,
          anzahl: e.anzahl,
          summe: round2(e.summe),
          durchschnitt: e.anzahl > 0 ? round2(e.summe / e.anzahl) : 0,
          konfidenz_avg:
            e.konfN > 0 ? Math.round((e.konfSum / e.konfN) * 100) / 100 : null,
        }))
        .sort((a, b) => Math.abs(b.summe) - Math.abs(a.summe));

      return {
        zeitraum: { von, bis },
        kategorien: ergebnis,
        anzahl_buchungen: buchungen.length,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// 3) cockpit_kennzahlen — Monatsverlauf + Top-Kategorien/Empfaenger
// ---------------------------------------------------------------------------

const cockpitKennzahlenInput = z.object({
  zeitraum_von: isoDate.optional(),
  zeitraum_bis: isoDate.optional(),
});

export function cockpitKennzahlenTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Liefert Finanz-Cockpit-Kennzahlen: Einnahmen, Ausgaben, Saldo, Buchungsanzahl + Monatsverlauf für einen Zeitraum (Standard: aktuelles Kalenderjahr).",
    inputSchema: cockpitKennzahlenInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const jetztJahr = new Date().getFullYear();
      const von = input.zeitraum_von ?? `${jetztJahr}-01-01`;
      const bis = input.zeitraum_bis ?? `${jetztJahr}-12-31`;

      const [bRes, kRes] = await Promise.all([
        supabase
          .from("buchung")
          .select(
            "buchung_datum, betrag, klassifikation, kategorie_id, empfaenger",
          )
          .eq("owner_id", ownerId)
          .gte("buchung_datum", von)
          .lte("buchung_datum", bis)
          .limit(20000),
        supabase
          .from("kategorie")
          .select("id, bezeichnung, typ")
          .eq("owner_id", ownerId)
          .limit(1000),
      ]);

      if (bRes.error) return { fehler: bRes.error.message };
      if (kRes.error) return { fehler: kRes.error.message };

      type B = {
        buchung_datum: string;
        betrag: number;
        klassifikation: Klassifikation | null;
        kategorie_id: string | null;
        empfaenger: string | null;
      };
      type K = { id: string; bezeichnung: string; typ: KategorieTyp };
      const buchungen = (bRes.data ?? []) as B[];
      const katMap = new Map((kRes.data ?? []).map((k) => [k.id, k as K]));

      function richtung(b: B): "einnahme" | "ausgabe" | "neutral" {
        const typ = b.kategorie_id ? katMap.get(b.kategorie_id)?.typ : null;
        if (typ === "einnahme") return "einnahme";
        if (typ === "ausgabe") return "ausgabe";
        if (typ === "neutral") return "neutral";
        const betrag = Number(b.betrag) || 0;
        if (betrag > 0) return "einnahme";
        if (betrag < 0) return "ausgabe";
        return "neutral";
      }

      const monatsMap = new Map<
        string,
        { monat: string; einnahmen: number; ausgaben: number }
      >();
      let einnahmen = 0;
      let ausgaben = 0;
      const empfAcc = new Map<string, { name: string; summe: number; anzahl: number }>();
      const katAcc = new Map<
        string,
        { id: string | null; bezeichnung: string; summe: number; anzahl: number }
      >();

      for (const b of buchungen) {
        const m = b.buchung_datum.slice(0, 7);
        const punkt = monatsMap.get(m) ?? { monat: m, einnahmen: 0, ausgaben: 0 };
        const r = richtung(b);
        const abs = Math.abs(Number(b.betrag) || 0);
        if (r === "einnahme") {
          punkt.einnahmen += abs;
          einnahmen += abs;
        } else if (r === "ausgabe") {
          punkt.ausgaben += abs;
          ausgaben += abs;
          // Top-Empfaenger + Top-Kategorien nur fuer Ausgaben.
          const eKey = (b.empfaenger ?? "(kein Empfänger)")
            .trim()
            .toUpperCase()
            .replace(/\s+/g, " ");
          const eintrag = empfAcc.get(eKey) ?? {
            name: b.empfaenger?.trim() || "(kein Empfänger)",
            summe: 0,
            anzahl: 0,
          };
          eintrag.summe += abs;
          eintrag.anzahl++;
          empfAcc.set(eKey, eintrag);

          const k = b.kategorie_id ? katMap.get(b.kategorie_id) : null;
          const kKey = b.kategorie_id ?? "__ohne__";
          const kEintrag = katAcc.get(kKey) ?? {
            id: b.kategorie_id,
            bezeichnung: k?.bezeichnung ?? "— ohne Kategorie —",
            summe: 0,
            anzahl: 0,
          };
          kEintrag.summe += abs;
          kEintrag.anzahl++;
          katAcc.set(kKey, kEintrag);
        }
        monatsMap.set(m, punkt);
      }

      const monate = Array.from(monatsMap.values())
        .map((p) => ({
          monat: p.monat,
          einnahmen: round2(p.einnahmen),
          ausgaben: round2(p.ausgaben),
          saldo: round2(p.einnahmen - p.ausgaben),
        }))
        .sort((a, b) => a.monat.localeCompare(b.monat));

      const topKategorien = Array.from(katAcc.values())
        .sort((a, b) => b.summe - a.summe)
        .slice(0, 8)
        .map((k) => ({
          kategorie_id: k.id,
          bezeichnung: k.bezeichnung,
          summe: round2(k.summe),
          anzahl: k.anzahl,
        }));

      const topEmpfaenger = Array.from(empfAcc.values())
        .sort((a, b) => b.summe - a.summe)
        .slice(0, 10)
        .map((e) => ({
          empfaenger: e.name,
          summe: round2(e.summe),
          anzahl: e.anzahl,
        }));

      return {
        zeitraum: { von, bis },
        kennzahlen: {
          einnahmen: round2(einnahmen),
          ausgaben: round2(ausgaben),
          saldo: round2(einnahmen - ausgaben),
          buchungen: buchungen.length,
        },
        monate,
        top_kategorien: topKategorien,
        top_empfaenger: topEmpfaenger,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// 4) wiederkehrende_buchungen — Abo-Radar
// ---------------------------------------------------------------------------

const wiederkehrendInput = z.object({
  zeitraum_bis: isoDate
    .optional()
    .describe(
      "Stichtag fuer den Lookback (Default: heute). Lookback betraegt mind. 365 Tage.",
    ),
  nur_aktive: z
    .boolean()
    .default(true)
    .describe(
      "true (Default): nur Abos, deren letzte Buchung < 1.5x Intervall her ist.",
    ),
});

export function wiederkehrendeBuchungenTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Erkennt wiederkehrende Buchungen (Abos, regelmäßige Einnahmen) heuristisch aus den letzten 12 Monaten. Liefert je Abo: Empfänger, Intervall, Jahresvolumen, Aktiv-Status.",
    inputSchema: wiederkehrendInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const bis = input.zeitraum_bis ?? isoHeute();
      const von = new Date(bis);
      von.setDate(von.getDate() - MIN_LOOKBACK_TAGE);
      const vonIso = von.toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from("buchung")
        .select(
          "id, konto_id, buchung_datum, betrag, empfaenger, empfaenger_normalisiert, klassifikation, kategorie_id, status",
        )
        .eq("owner_id", ownerId)
        .gte("buchung_datum", vonIso)
        .lte("buchung_datum", bis)
        .order("buchung_datum", { ascending: true })
        .limit(20000);
      if (error) return { fehler: error.message };

      type B = {
        id: string;
        konto_id: string;
        buchung_datum: string;
        betrag: number;
        empfaenger: string | null;
        empfaenger_normalisiert: string | null;
        klassifikation: Klassifikation | null;
        kategorie_id: string | null;
        status: BuchungStatus;
      };
      const rows = ((data ?? []) as B[]).filter((b) => Number(b.betrag) !== 0);

      const gruppen = new Map<string, B[]>();
      for (const b of rows) {
        const key =
          (b.empfaenger_normalisiert ?? "").trim() ||
          normalisiereEmpfaenger(b.empfaenger);
        if (!key) continue;
        const arr = gruppen.get(key) ?? [];
        arr.push(b);
        gruppen.set(key, arr);
      }

      const heute = new Date();
      const items: Array<{
        empfaenger: string;
        intervall: string;
        intervall_tage: number;
        durchschnitt: number;
        jahresvolumen: number;
        richtung: "einnahme" | "ausgabe";
        anzahl: number;
        erste: string;
        letzte: string;
        aktiv: boolean;
        konfidenz: number;
      }> = [];

      for (const [, buchungen] of gruppen) {
        if (buchungen.length < MIN_BUCHUNGEN) continue;
        buchungen.sort((a, b) =>
          a.buchung_datum.localeCompare(b.buchung_datum),
        );
        const cluster = erkenneCluster(buchungen);
        if (!cluster) continue;
        const profil = klassifiziereIntervall(cluster.intervall_tage);
        if (!profil) continue;
        const letzte = buchungen[buchungen.length - 1].buchung_datum;
        const seit = tageZwischen(letzte, heute.toISOString().slice(0, 10));
        const aktiv = seit <= profil.max * 1.5;
        if (input.nur_aktive && !aktiv) continue;
        items.push({
          empfaenger: modusEmpfaenger(buchungen.map((b) => b.empfaenger)) ?? "—",
          intervall: cluster.intervall,
          intervall_tage: cluster.intervall_tage,
          durchschnitt: round2(cluster.betrag_median),
          jahresvolumen: round2(cluster.jahresvolumen),
          richtung: cluster.richtung,
          anzahl: cluster.anzahl,
          erste: buchungen[0].buchung_datum,
          letzte,
          aktiv,
          konfidenz: round2(cluster.konfidenz),
        });
      }

      items.sort((a, b) => {
        if (a.aktiv !== b.aktiv) return a.aktiv ? -1 : 1;
        return b.jahresvolumen - a.jahresvolumen;
      });

      return {
        zeitraum: { von: vonIso, bis },
        anzahl: items.length,
        items,
        jahresvolumen_summe_ausgaben: round2(
          items
            .filter((i) => i.aktiv && i.richtung === "ausgabe")
            .reduce((s, i) => s + i.jahresvolumen, 0),
        ),
        jahresvolumen_summe_einnahmen: round2(
          items
            .filter((i) => i.aktiv && i.richtung === "einnahme")
            .reduce((s, i) => s + i.jahresvolumen, 0),
        ),
      };
    },
  });
}

// ---------------------------------------------------------------------------
// 5) pruefliste — Buchungen mit status='zur_pruefung', gruppiert nach Grund
// ---------------------------------------------------------------------------

const prueflisteInput = z.object({
  limit: z.number().int().min(1).max(200).default(50),
});

export function prueflisteTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Zeigt Buchungen in der Prüfliste (status='zur_pruefung'), gruppiert nach pruef_grund. Liefert je Grund: Anzahl, betroffene IDs (Stichprobe).",
    inputSchema: prueflisteInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const { data, error } = await supabase
        .from("buchung")
        .select(
          "id, buchung_datum, empfaenger, verwendungszweck, betrag, pruef_grund, konfidenz",
        )
        .eq("owner_id", ownerId)
        .eq("status", "zur_pruefung")
        .order("buchung_datum", { ascending: false })
        .limit(input.limit);
      if (error) return { fehler: error.message };

      type Row = {
        id: string;
        buchung_datum: string;
        empfaenger: string | null;
        verwendungszweck: string | null;
        betrag: number;
        pruef_grund: string | null;
        konfidenz: number | null;
      };
      const rows = (data ?? []) as Row[];

      const gruppen = new Map<
        string,
        {
          grund: string;
          anzahl: number;
          beispiele: Array<{
            id: string;
            datum: string;
            empfaenger: string | null;
            betrag: number;
          }>;
        }
      >();
      for (const r of rows) {
        const g = r.pruef_grund ?? "(kein Grund)";
        const e = gruppen.get(g) ?? { grund: g, anzahl: 0, beispiele: [] };
        e.anzahl++;
        if (e.beispiele.length < 5) {
          e.beispiele.push({
            id: r.id,
            datum: r.buchung_datum,
            empfaenger: r.empfaenger,
            betrag: Number(r.betrag) || 0,
          });
        }
        gruppen.set(g, e);
      }
      return {
        gesamt: rows.length,
        nach_grund: Array.from(gruppen.values()).sort(
          (a, b) => b.anzahl - a.anzahl,
        ),
      };
    },
  });
}

// ---------------------------------------------------------------------------
// 6) umsatzsteuer_stand — laufende USt-Periode aggregiert
// ---------------------------------------------------------------------------

const umsatzsteuerInput = z.object({
  jahr: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional()
    .describe("Steuerjahr. Default: aktuelles Jahr."),
  monat: z
    .number()
    .int()
    .min(1)
    .max(12)
    .optional()
    .describe(
      "Monat (1-12). Wenn gesetzt, wird nur dieser Monat aggregiert; sonst gesamtes Jahr.",
    ),
});

export function umsatzsteuerStandTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Aktueller Stand der Umsatzsteuer (USt). Aggregiert Vereinnahmte USt (Einnahmen) und Vorsteuer (Ausgaben) im angegebenen Zeitraum.",
    inputSchema: umsatzsteuerInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const jahr = input.jahr ?? new Date().getFullYear();
      let von: string;
      let bis: string;
      if (input.monat) {
        const m = String(input.monat).padStart(2, "0");
        von = `${jahr}-${m}-01`;
        // letzter Tag des Monats:
        const last = new Date(jahr, input.monat, 0).getDate();
        bis = `${jahr}-${m}-${String(last).padStart(2, "0")}`;
      } else {
        von = `${jahr}-01-01`;
        bis = `${jahr}-12-31`;
      }

      const { data, error } = await supabase
        .from("buchung")
        .select(
          "betrag, ust_satz, kategorie_id, klassifikation, steuerrelevant, kategorie:kategorie(typ)",
        )
        .eq("owner_id", ownerId)
        .eq("steuerrelevant", true)
        .gte("buchung_datum", von)
        .lte("buchung_datum", bis)
        .limit(20000);
      if (error) return { fehler: error.message };

      type Row = {
        betrag: number;
        ust_satz: number | null;
        kategorie_id: string | null;
        klassifikation: Klassifikation | null;
        steuerrelevant: boolean | null;
        kategorie: { typ: KategorieTyp } | Array<{ typ: KategorieTyp }> | null;
      };
      const rows = (data ?? []) as Row[];

      let vereinnahmt = 0; // USt aus Einnahmen
      let vorsteuer = 0; // USt aus Ausgaben (abzugsfaehig)
      const proSatz = new Map<
        number,
        { satz: number; netto_einnahmen: number; ust_einnahmen: number; netto_ausgaben: number; ust_ausgaben: number }
      >();

      for (const r of rows) {
        const betrag = Number(r.betrag) || 0;
        const satz = r.ust_satz === null ? null : Number(r.ust_satz);
        if (satz === null || satz === 0) continue;
        const kat = Array.isArray(r.kategorie) ? r.kategorie[0] : r.kategorie;
        const istEinnahme =
          kat?.typ === "einnahme" || (kat?.typ === undefined && betrag > 0);
        // Rohbetrag = brutto (Bank-Sicht). USt = brutto * satz / (100+satz).
        const ustAnteil = Math.abs(betrag) * (satz / (100 + satz));
        const nettoAnteil = Math.abs(betrag) - ustAnteil;
        const e = proSatz.get(satz) ?? {
          satz,
          netto_einnahmen: 0,
          ust_einnahmen: 0,
          netto_ausgaben: 0,
          ust_ausgaben: 0,
        };
        if (istEinnahme) {
          vereinnahmt += ustAnteil;
          e.netto_einnahmen += nettoAnteil;
          e.ust_einnahmen += ustAnteil;
        } else {
          vorsteuer += ustAnteil;
          e.netto_ausgaben += nettoAnteil;
          e.ust_ausgaben += ustAnteil;
        }
        proSatz.set(satz, e);
      }

      return {
        zeitraum: { von, bis },
        zahllast: round2(vereinnahmt - vorsteuer),
        vereinnahmte_ust: round2(vereinnahmt),
        vorsteuer: round2(vorsteuer),
        nach_satz: Array.from(proSatz.values())
          .sort((a, b) => a.satz - b.satz)
          .map((e) => ({
            satz: e.satz,
            netto_einnahmen: round2(e.netto_einnahmen),
            ust_einnahmen: round2(e.ust_einnahmen),
            netto_ausgaben: round2(e.netto_ausgaben),
            ust_ausgaben: round2(e.ust_ausgaben),
          })),
        anzahl_buchungen: rows.length,
        hinweis:
          "Vorlaeufiger Stand auf Basis der aktuellen Buchungen. Keine UStVA-Festsetzung.",
      };
    },
  });
}

// ---------------------------------------------------------------------------
// 7) buchung_details — eine einzelne Buchung mit Audit-Spur
// ---------------------------------------------------------------------------

const buchungDetailsInput = z.object({
  buchung_id: z.uuid().describe("ID der Buchung."),
});

export function buchungDetailsTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Liefert alle Details zu einer einzelnen Buchung inkl. verknüpfter Belege + Audit-Historie. Erwartet eine konkrete buchung_id.",
    inputSchema: buchungDetailsInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      const { data, error } = await supabase
        .from("buchung")
        .select(
          "id, buchung_datum, betrag, waehrung, verwendungszweck, empfaenger, klassifikation, steuerrelevant, kategorie_id, ust_satz, begruendung, konfidenz, quelle, status, pruef_grund, kategorie:kategorie(bezeichnung, typ), konto:konto(bezeichnung)",
        )
        .eq("owner_id", ownerId)
        .eq("id", input.buchung_id)
        .maybeSingle();
      if (error) return { fehler: error.message };
      if (!data) return { fehler: "Buchung nicht gefunden." };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = data as any;
      const kat = Array.isArray(b.kategorie) ? b.kategorie[0] : b.kategorie;
      const kto = Array.isArray(b.konto) ? b.konto[0] : b.konto;

      const { data: audit } = await supabase
        .from("audit_eintrag")
        .select("id, aktion, quelle, details, created_at")
        .eq("owner_id", ownerId)
        .eq("entitaet", "buchung")
        .eq("entitaet_id", input.buchung_id)
        .order("created_at", { ascending: false })
        .limit(20);

      return {
        id: b.id,
        datum: b.buchung_datum,
        empfaenger: b.empfaenger,
        verwendungszweck: b.verwendungszweck,
        betrag: Number(b.betrag) || 0,
        waehrung: b.waehrung,
        klassifikation: b.klassifikation,
        steuerrelevant: b.steuerrelevant,
        kategorie_id: b.kategorie_id,
        kategorie_bezeichnung: kat?.bezeichnung ?? null,
        kategorie_typ: kat?.typ ?? null,
        ust_satz: b.ust_satz === null ? null : Number(b.ust_satz),
        konfidenz: b.konfidenz === null ? null : Number(b.konfidenz),
        begruendung: b.begruendung,
        quelle: b.quelle,
        status: b.status,
        pruef_grund: b.pruef_grund,
        konto_bezeichnung: kto?.bezeichnung ?? null,
        audit_eintraege: (audit ?? []).slice(0, 20),
      };
    },
  });
}

// ---------------------------------------------------------------------------
// 8) empfaenger_kenntnis_lookup — Cache fuer einen Empfaenger
// ---------------------------------------------------------------------------

const empfaengerKenntnisInput = z.object({
  empfaenger_norm: z
    .string()
    .min(1)
    .max(120)
    .describe(
      "Normalisierter Empfaenger-Schluessel. Falls unsicher: einfach den Roh-Empfaenger uebergeben; das Tool normalisiert.",
    ),
});

export function empfaengerKenntnisLookupTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Liefert das Empfaenger-Cache-Eintrag (Branche, Leistung, Web-Snippets, letzte Klassifikation) zu einem normalisierten Empfaengernamen. Liefert null, wenn nicht vorhanden.",
    inputSchema: empfaengerKenntnisInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      // Wir akzeptieren auch Roh-Namen — defensiv normalisieren.
      const norm = normalisiereEmpfaenger(input.empfaenger_norm) || input.empfaenger_norm.trim();
      const { data, error } = await supabase
        .from("empfaenger_kenntnis")
        .select(
          "empfaenger_norm, rohwert_beispiel, branche, leistung, web_snippets, letzte_klassifikation_default, quelle, recherche_versucht, cached_at, ttl_tage",
        )
        .eq("owner_id", ownerId)
        .eq("empfaenger_norm", norm)
        .maybeSingle();
      if (error) return { fehler: error.message };
      return { eintrag: data ?? null, normalisiert: norm };
    },
  });
}

// ---------------------------------------------------------------------------
// 9) lernregeln_liste — alle Lernregeln (aktive zuerst)
// ---------------------------------------------------------------------------

export function lernregelnListeTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Listet alle Lernregeln des Owners auf — aktive zuerst, dann nach Prioritaet absteigend. Liefert ID, Bezeichnung, Bedingung, Aktion, Prioritaet, Aktiv-Status, Treffer-Zaehler.",
    inputSchema: z.object({}),
    execute: async () => {
      const { supabase, ownerId } = ctx;
      const { data, error } = await supabase
        .from("lernregel")
        .select(
          "id, bezeichnung, bedingung, aktion, prioritaet, aktiv, treffer_zaehler, updated_at",
        )
        .eq("owner_id", ownerId)
        .order("aktiv", { ascending: false })
        .order("prioritaet", { ascending: false })
        .limit(500);
      if (error) return { fehler: error.message };
      return { regeln: data ?? [] };
    },
  });
}

// ---------------------------------------------------------------------------
// 10) mein_profil_kontext — persoenliche Stammdaten
// ---------------------------------------------------------------------------

export function meinProfilKontextTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Liefert die persoenlichen Stammdaten des Inhabers (Arbeitgeber, Familienmitglieder, Adresse, eigene Bankkonten) — relevant fuer die Klassifikation von Buchungen.",
    inputSchema: z.object({}),
    execute: async () => {
      const { supabase, ownerId } = ctx;
      const profil = await holeProfil(supabase, ownerId);
      return {
        hat_inhalt: profilHatInhalt(profil),
        profil,
      };
    },
  });
}

// ---------------------------------------------------------------------------
// 11) kategorien_liste — alle Kategorien
// ---------------------------------------------------------------------------

const kategorienListeInput = z.object({
  nur_aktive: z.boolean().default(true).describe("Default: nur aktive."),
});

export function kategorienListeTool(ctx: ChatToolContext) {
  return tool({
    description:
      "Listet alle Kategorien des EÜR-Kontenrahmens: ID, Bezeichnung, Typ (einnahme|ausgabe|privat|neutral), USt-Satz, Aktiv-Status. Wichtig fuer Schreib-Tools, die eine Kategorie-ID brauchen.",
    inputSchema: kategorienListeInput,
    execute: async (input) => {
      const { supabase, ownerId } = ctx;
      let q = supabase
        .from("kategorie")
        .select(
          "id, bezeichnung, typ, ust_satz, euer_zeile, elster_kennzahl, aktiv",
        )
        .eq("owner_id", ownerId)
        .order("typ", { ascending: true })
        .order("bezeichnung", { ascending: true })
        .limit(500);
      if (input.nur_aktive) q = q.eq("aktiv", true);
      const { data, error } = await q;
      if (error) return { fehler: error.message };
      return { kategorien: data ?? [] };
    },
  });
}

// ---------------------------------------------------------------------------
// Sammelfunktion — gibt alle Lese-Tools als ToolSet zurueck.
// ---------------------------------------------------------------------------

export function baueLeseTools(ctx: ChatToolContext) {
  return {
    suche_buchungen: sucheBuchungenTool(ctx),
    aggregat_kategorien: aggregatKategorienTool(ctx),
    cockpit_kennzahlen: cockpitKennzahlenTool(ctx),
    wiederkehrende_buchungen: wiederkehrendeBuchungenTool(ctx),
    pruefliste: prueflisteTool(ctx),
    umsatzsteuer_stand: umsatzsteuerStandTool(ctx),
    buchung_details: buchungDetailsTool(ctx),
    empfaenger_kenntnis_lookup: empfaengerKenntnisLookupTool(ctx),
    lernregeln_liste: lernregelnListeTool(ctx),
    mein_profil_kontext: meinProfilKontextTool(ctx),
    kategorien_liste: kategorienListeTool(ctx),
  };
}
