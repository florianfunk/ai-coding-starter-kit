"use client";

// PROJ-17 — Top-Level-Client-Component fuer /chat.
//
// State-Container:
//  - Konversationsliste (mockKonversationen)
//  - Aktive Konversation + Nachrichten
//  - Streaming-Status (welche Assistant-Nachricht-Id streamt gerade?)
//  - Eingabefeld-Wert
//
// Orchestriert die drei UI-Bausteine: ChatLayout / KonversationsListe /
// KonversationsAnsicht.
//
// TODO Backend (durchgehend): jede Mock-Funktion ist in
// /lib/chat/mock-daten.ts markiert. Wenn die echten Endpoints existieren,
// ersetzt man dort die Bodies durch `fetch()`-Aufrufe — die hier
// aufrufenden Stellen koennen unveraendert bleiben.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  mockAntwortStream,
  mockKonversationLoeschen,
  mockKonversationUmbenennen,
  mockNachrichten,
  mockNachrichtenNachtrag,
  mockNeueKonversation,
} from "@/lib/chat/mock-daten";
import type {
  ChatAktion,
  ChatKonversation,
  ChatNachricht,
} from "@/lib/chat/typen";
import { ChatLayout } from "./chat-layout";
import { KonversationsAnsicht } from "./konversations-ansicht";
import { KonversationsListe } from "./konversations-liste";

interface Props {
  initialKonversationen: ChatKonversation[];
  initialAktiveId: string | null;
  initialNachrichten: ChatNachricht[];
}

export function ChatPageInhalt({
  initialKonversationen,
  initialAktiveId,
  initialNachrichten,
}: Props) {
  const [konversationen, setKonversationen] =
    useState<ChatKonversation[]>(initialKonversationen);
  const [aktiveId, setAktiveId] = useState<string | null>(initialAktiveId);
  const [nachrichten, setNachrichten] =
    useState<ChatNachricht[]>(initialNachrichten);
  const [laedtNachrichten, setLaedtNachrichten] = useState(false);
  const [eingabe, setEingabe] = useState("");
  const [streamendeId, setStreamendeId] = useState<string | null>(null);
  const [mobilAnsicht, setMobilAnsicht] = useState<"liste" | "ansicht">(
    initialAktiveId ? "ansicht" : "liste",
  );

  const aktiveKonversation = useMemo(
    () => konversationen.find((k) => k.id === aktiveId) ?? null,
    [konversationen, aktiveId],
  );

  // Bei Wechsel der aktiven Konversation: Nachrichten neu laden.
  useEffect(() => {
    if (!aktiveId) {
      setNachrichten([]);
      return;
    }
    // Wenn wir gerade gestreamt haben oder mock-initialisiert sind und der
    // State schon zu dieser Konv passt, nichts tun.
    if (
      nachrichten.length > 0 &&
      nachrichten[0].konversation_id === aktiveId
    ) {
      return;
    }
    setLaedtNachrichten(true);
    // Mock laeuft synchron, aber wir setzen das laedt-Flag fuer UX-Konsistenz
    // und um den Skeleton-Pfad real durchzuspielen.
    // TODO Backend: ersetze durch fetch(`/api/chat/${aktiveId}`)
    const list = mockNachrichten(aktiveId);
    setNachrichten(list);
    setLaedtNachrichten(false);
  }, [aktiveId, nachrichten]);

  const onWaehlen = useCallback((id: string) => {
    setAktiveId(id);
    setMobilAnsicht("ansicht");
  }, []);

  const onNeu = useCallback(async () => {
    // TODO Backend: ersetze durch
    //   const res = await fetch("/api/chat/konversationen", { method: "POST" });
    //   const json = await res.json();
    //   const neue = json.konversation as ChatKonversation;
    const neue = mockNeueKonversation();
    setKonversationen((prev) => [neue, ...prev]);
    setAktiveId(neue.id);
    setNachrichten([]);
    setEingabe("");
    setMobilAnsicht("ansicht");
  }, []);

  const onUmbenennen = useCallback(
    async (id: string, neuerTitel: string) => {
      // TODO Backend: ersetze durch PATCH /api/chat/[id] mit { titel }
      const aktualisiert = mockKonversationUmbenennen(id, neuerTitel);
      if (!aktualisiert) {
        toast.error("Konversation nicht gefunden.");
        return;
      }
      setKonversationen((prev) =>
        prev.map((k) => (k.id === id ? aktualisiert : k)),
      );
      toast.success("Chat umbenannt.");
    },
    [],
  );

  const onLoeschen = useCallback(
    async (id: string) => {
      // TODO Backend: ersetze durch DELETE /api/chat/[id]
      const ok = mockKonversationLoeschen(id);
      if (!ok) {
        toast.error("Löschen fehlgeschlagen.");
        return;
      }
      setKonversationen((prev) => prev.filter((k) => k.id !== id));
      if (aktiveId === id) {
        setAktiveId(null);
        setNachrichten([]);
        setMobilAnsicht("liste");
      }
      toast.success("Chat gelöscht.");
    },
    [aktiveId],
  );

  const onSenden = useCallback(async () => {
    const text = eingabe.trim();
    if (!text || streamendeId !== null) return;
    if (!aktiveId) {
      // Wenn noch keine Konversation aktiv ist, eine neue anlegen und
      // direkt die Nachricht reinschicken.
      const neue = mockNeueKonversation();
      setKonversationen((prev) => [neue, ...prev]);
      setAktiveId(neue.id);
      setMobilAnsicht("ansicht");
      await sendInKonversation(neue.id, text);
      return;
    }
    await sendInKonversation(aktiveId, text);
    // sendInKonversation ist hier eine closure ueber die State-Setter.
    // Aufruf-Logik: erst User-Nachricht append, dann Assistant-Stub,
    // dann Stream-Tokens anhaengen, am Ende Tools + ggf. Aktion ergaenzen.
  }, [eingabe, streamendeId, aktiveId]);

  // Hilfsfunktion: User-Nachricht + Streaming-Assistant-Antwort fuer eine
  // konkrete Konversation.
  async function sendInKonversation(konversationId: string, text: string) {
    const userNachricht: ChatNachricht = {
      id: `n-user-${Date.now()}`,
      konversation_id: konversationId,
      rolle: "user",
      inhalt: text,
      tools: [],
      aktion: null,
      erstellt_am: new Date().toISOString(),
    };
    const assistantId = `n-asst-${Date.now()}`;
    const assistantStub: ChatNachricht = {
      id: assistantId,
      konversation_id: konversationId,
      rolle: "assistant",
      inhalt: "",
      tools: [],
      aktion: null,
      erstellt_am: new Date().toISOString(),
    };

    setEingabe("");
    setNachrichten((prev) => [...prev, userNachricht, assistantStub]);
    setStreamendeId(assistantId);

    // Konversations-Vorschau in der Liste aktualisieren
    setKonversationen((prev) =>
      prev.map((k) =>
        k.id === konversationId
          ? {
              ...k,
              vorschau: text,
              aktualisiert_am: new Date().toISOString(),
              titel:
                k.titel === "Neuer Chat" && text.length > 0
                  ? text.slice(0, 60)
                  : k.titel,
            }
          : k,
      ),
    );

    try {
      // TODO Backend: ersetze durch echten Stream aus
      //   POST /api/chat/[konversationId]/nachricht
      // via Vercel AI SDK v6 (`useChat`-Hook oder `streamText`).
      for await (const chunk of mockAntwortStream(text)) {
        setNachrichten((prev) =>
          prev.map((n) =>
            n.id === assistantId
              ? { ...n, inhalt: n.inhalt + chunk }
              : n,
          ),
        );
      }
      // Stream fertig — Tools + ggf. Aktions-Vorschlag ergaenzen.
      const nachtrag = mockNachrichtenNachtrag(text);
      setNachrichten((prev) =>
        prev.map((n) =>
          n.id === assistantId
            ? { ...n, tools: nachtrag.tools, aktion: nachtrag.aktion }
            : n,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Antwort fehlgeschlagen: ${msg}`);
      setNachrichten((prev) =>
        prev.map((n) =>
          n.id === assistantId
            ? {
                ...n,
                inhalt:
                  n.inhalt ||
                  "_Die Antwort konnte nicht generiert werden. Bitte erneut versuchen._",
              }
            : n,
        ),
      );
    } finally {
      setStreamendeId(null);
    }
  }

  const onAktionStatusChange = useCallback(
    (nachrichtId: string, nextAktion: ChatAktion) => {
      setNachrichten((prev) =>
        prev.map((n) =>
          n.id === nachrichtId ? { ...n, aktion: nextAktion } : n,
        ),
      );
    },
    [],
  );

  return (
    <ChatLayout
      mobilAnsicht={mobilAnsicht}
      setMobilAnsicht={setMobilAnsicht}
      sidebar={
        <KonversationsListe
          konversationen={konversationen}
          aktiveId={aktiveId}
          laedt={false}
          onWaehlen={onWaehlen}
          onNeu={onNeu}
          onUmbenennen={onUmbenennen}
          onLoeschen={onLoeschen}
        />
      }
      ansicht={(mobilZurueckButton) => (
        <KonversationsAnsicht
          konversation={aktiveKonversation}
          nachrichten={nachrichten}
          laedtNachrichten={laedtNachrichten}
          streamendeId={streamendeId}
          eingabe={eingabe}
          onEingabeChange={setEingabe}
          onSenden={onSenden}
          onLoeschen={async () => {
            if (aktiveKonversation) await onLoeschen(aktiveKonversation.id);
          }}
          onAktionStatusChange={onAktionStatusChange}
          mobilZurueckButton={mobilZurueckButton}
        />
      )}
    />
  );
}
