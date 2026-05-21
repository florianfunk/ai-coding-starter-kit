// PROJ-17 — KI-Chat-Seite (Server Component).
//
// Lädt Initial-Daten direkt server-seitig aus Supabase und reicht sie an
// die Client-Komponente weiter. Auth via requireUser (Redirect bei
// fehlender Session).

import { requireUser } from "@/lib/auth/guard";
import { ChatPageInhalt } from "@/components/chat/chat-page-inhalt";
import { createClient } from "@/lib/supabase/server";
import {
  holeKonversation,
  holeKonversationen,
} from "@/lib/chat/konversation";
import type {
  ChatAktion,
  ChatKonversation,
  ChatNachricht,
  VorherNachherZeile,
} from "@/lib/chat/typen";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "KI-Chat · STEUERAGENT",
};

interface BackendAktion {
  id: string;
  nachricht_id: string;
  aktion: string;
  parameter: Record<string, unknown>;
  vorschau: string;
  vorher_nachher: unknown;
  status: ChatAktion["status"];
  erstellt_am: string;
  aktualisiert_am: string;
  fehler_text: string | null;
}

function titel(aktion: string, parameter: Record<string, unknown>): string {
  switch (aktion) {
    case "lege_kategorie_an":
      return `Neue Kategorie: ${parameter.bezeichnung ?? ""}`;
    case "aendere_kategorie":
      return "Kategorie ändern";
    case "loesche_kategorie":
      return "Kategorie löschen";
    case "bucheBuchungenUm": {
      const n = Array.isArray(parameter.buchung_ids)
        ? parameter.buchung_ids.length
        : 0;
      return `${n} Buchung${n === 1 ? "" : "en"} umbuchen`;
    }
    case "manuell_bestaetige_buchungen": {
      const n = Array.isArray(parameter.buchung_ids)
        ? parameter.buchung_ids.length
        : 0;
      return `${n} Buchung${n === 1 ? "" : "en"} bestätigen`;
    }
    case "lege_lernregel_an":
      return `Neue Lernregel: ${parameter.bezeichnung ?? ""}`;
    case "aendere_lernregel":
      return "Lernregel ändern";
    case "loesche_lernregel":
      return "Lernregel löschen";
    case "setze_empfaenger_kenntnis":
      return `Empfänger-Kenntnis: ${parameter.empfaenger_norm ?? ""}`;
    case "loesche_empfaenger_kenntnis":
      return `Empfänger-Kenntnis löschen: ${parameter.empfaenger_norm ?? ""}`;
    default:
      return aktion;
  }
}

function mapAktion(a: BackendAktion): ChatAktion {
  const vnRaw = Array.isArray(a.vorher_nachher) ? a.vorher_nachher : null;
  const vorher_nachher: VorherNachherZeile[] | null = vnRaw
    ? vnRaw
        .filter(
          (z): z is Record<string, unknown> =>
            typeof z === "object" && z !== null,
        )
        .map((z, i) => ({
          id: String(z.id ?? `zeile-${i}`),
          datum: String(z.datum ?? ""),
          empfaenger: String(z.empfaenger ?? ""),
          betrag: String(z.betrag ?? ""),
          vorher: String(z.vorher ?? ""),
          nachher: String(z.nachher ?? ""),
        }))
    : null;
  return {
    id: a.id,
    aktion: a.aktion,
    titel: titel(a.aktion, a.parameter),
    vorschau: a.vorschau,
    parameter: a.parameter,
    vorher_nachher,
    status: a.status,
    ausgefuehrt_am:
      a.status === "confirmed" || a.status === "cancelled"
        ? a.aktualisiert_am
        : null,
    fehler_text: a.fehler_text,
  };
}

function kurzZusammen(toolCalls: unknown, toolResults: unknown): unknown[] {
  const calls = Array.isArray(toolCalls) ? toolCalls : [];
  const results = Array.isArray(toolResults) ? toolResults : [];
  return calls.map((c, i) => {
    const rec = c as { toolName?: string; input?: unknown; args?: unknown };
    const result = results[i];
    const o = (result && typeof result === "object" ? (result as Record<string, unknown>) : {}) as Record<string, unknown>;
    const out = (o.output as Record<string, unknown> | undefined) ?? o;
    let zus = "OK";
    if (typeof out.fehler === "string") zus = `Fehler: ${out.fehler}`;
    else if (typeof out.anzahl === "number") zus = `${out.anzahl} Treffer`;
    else if (Array.isArray(out.buchungen)) zus = `${out.buchungen.length} Buchungen`;
    else if (Array.isArray(out.kategorien)) zus = `${out.kategorien.length} Kategorien`;
    else if (typeof out.aktion_id === "string")
      zus = `Vorschlag angelegt`;
    return {
      name: rec.toolName ?? "tool",
      parameter:
        (rec.input as Record<string, unknown> | undefined) ??
        (rec.args as Record<string, unknown> | undefined) ??
        {},
      ergebnis_zusammenfassung: zus,
    };
  });
}

export default async function ChatPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const liste = await holeKonversationen(supabase, user.id);
  const konversationen: ChatKonversation[] = liste.map((k) => ({
    id: k.id,
    titel: k.titel,
    erstellt_am: k.erstellt_am,
    aktualisiert_am: k.aktualisiert_am,
    vorschau: k.vorschau,
  }));
  const aktiveId = konversationen[0]?.id ?? null;
  let nachrichten: ChatNachricht[] = [];
  if (aktiveId) {
    const detail = await holeKonversation(supabase, user.id, aktiveId);
    if (detail) {
      // Mehrere Aktionen pro Nachricht sammeln (chronologisch).
      const aktionenJeNachricht = new Map<string, BackendAktion[]>();
      const sortAktionen = [...detail.aktionen].sort((a, b) =>
        (a.erstellt_am ?? "").localeCompare(b.erstellt_am ?? ""),
      );
      for (const a of sortAktionen) {
        const arr = aktionenJeNachricht.get(a.nachricht_id) ?? [];
        arr.push(a as BackendAktion);
        aktionenJeNachricht.set(a.nachricht_id, arr);
      }
      nachrichten = detail.nachrichten
        .filter((n) => n.rolle === "user" || n.rolle === "assistant" || n.rolle === "tool")
        .map((n) => ({
          id: n.id,
          konversation_id: n.konversation_id,
          rolle: n.rolle as ChatNachricht["rolle"],
          inhalt: n.inhalt,
          tools:
            n.rolle === "assistant"
              ? (kurzZusammen(n.tool_calls, n.tool_results) as ChatNachricht["tools"])
              : [],
          aktionen: (aktionenJeNachricht.get(n.id) ?? []).map(mapAktion),
          erstellt_am: n.erstellt_am,
        }));
    }
  }

  return (
    <div className="-mx-6 -my-8 h-[calc(100vh-56px)] md:-mx-8 md:-my-8 md:h-[calc(100vh-56px)]">
      {/*
        Volle Hoehe fuer den Chat — wir kompensieren das Standard-Padding
        des AppLayouts (px-6 py-8 / md:px-8) und rechnen die Topbar (56 px)
        raus, damit das Chat-Panel exakt den Viewport ausfuellt.
      */}
      <div className="h-full px-4 py-4 md:px-6 md:py-6">
        <ChatPageInhalt
          initialKonversationen={konversationen}
          initialAktiveId={aktiveId}
          initialNachrichten={nachrichten}
        />
      </div>
    </div>
  );
}
