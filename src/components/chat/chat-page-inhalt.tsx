"use client";

// PROJ-17 — Top-Level-Client-Component fuer /chat.
//
// State-Container, der die echten API-Endpoints aus `@/lib/chat/api` und
// `@/lib/chat/mock-daten` (jetzt ein Wrapper) nutzt. Token-Stream kommt aus
// dem Backend, Tool-Badges + Aktions-Vorschlaege werden nach Stream-Ende
// per GET nachgeladen.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  holeNachrichtenApi,
  legeKonversationApi,
  loescheKonversationApi,
  sendeNachrichtStream,
  umbenenneKonversationApi,
} from "@/lib/chat/api";
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

  // Bei Wechsel der aktiven Konversation: Nachrichten vom Backend laden.
  useEffect(() => {
    if (!aktiveId) {
      setNachrichten([]);
      return;
    }
    // Wenn die geladenen Nachrichten schon zur aktiven Konv gehoeren,
    // nichts tun.
    if (
      nachrichten.length > 0 &&
      nachrichten[0].konversation_id === aktiveId
    ) {
      return;
    }
    let abgebrochen = false;
    setLaedtNachrichten(true);
    holeNachrichtenApi(aktiveId)
      .then((list) => {
        if (abgebrochen) return;
        setNachrichten(list);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Ladefehler";
        toast.error(`Nachrichten konnten nicht geladen werden: ${msg}`);
      })
      .finally(() => {
        if (!abgebrochen) setLaedtNachrichten(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [aktiveId, nachrichten]);

  const onWaehlen = useCallback((id: string) => {
    setAktiveId(id);
    setMobilAnsicht("ansicht");
  }, []);

  const onNeu = useCallback(async () => {
    try {
      const neue = await legeKonversationApi();
      setKonversationen((prev) => [neue, ...prev]);
      setAktiveId(neue.id);
      setNachrichten([]);
      setEingabe("");
      setMobilAnsicht("ansicht");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler";
      toast.error(`Neue Konversation fehlgeschlagen: ${msg}`);
    }
  }, []);

  const onUmbenennen = useCallback(
    async (id: string, neuerTitel: string) => {
      try {
        await umbenenneKonversationApi(id, neuerTitel);
        setKonversationen((prev) =>
          prev.map((k) =>
            k.id === id
              ? {
                  ...k,
                  titel: neuerTitel,
                  aktualisiert_am: new Date().toISOString(),
                }
              : k,
          ),
        );
        toast.success("Chat umbenannt.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Fehler";
        toast.error(`Umbenennen fehlgeschlagen: ${msg}`);
      }
    },
    [],
  );

  const onLoeschen = useCallback(
    async (id: string) => {
      try {
        await loescheKonversationApi(id);
        setKonversationen((prev) => prev.filter((k) => k.id !== id));
        if (aktiveId === id) {
          setAktiveId(null);
          setNachrichten([]);
          setMobilAnsicht("liste");
        }
        toast.success("Chat gelöscht.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Fehler";
        toast.error(`Löschen fehlgeschlagen: ${msg}`);
      }
    },
    [aktiveId],
  );

  const onSenden = useCallback(async () => {
    const text = eingabe.trim();
    if (!text || streamendeId !== null) return;
    if (!aktiveId) {
      // Erst eine Konversation anlegen.
      try {
        const neue = await legeKonversationApi();
        setKonversationen((prev) => [neue, ...prev]);
        setAktiveId(neue.id);
        setMobilAnsicht("ansicht");
        await sendInKonversation(neue.id, text);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Fehler";
        toast.error(`Senden fehlgeschlagen: ${msg}`);
      }
      return;
    }
    await sendInKonversation(aktiveId, text);
  }, [eingabe, streamendeId, aktiveId]);

  // Sendet User-Nachricht + streamt Antwort + laedt Tool-Calls/Aktion nach.
  async function sendInKonversation(konversationId: string, text: string) {
    // Optimistische User-Nachricht.
    const userNachricht: ChatNachricht = {
      id: `n-user-temp-${Date.now()}`,
      konversation_id: konversationId,
      rolle: "user",
      inhalt: text,
      tools: [],
      aktion: null,
      erstellt_am: new Date().toISOString(),
    };
    const assistantTempId = `n-asst-temp-${Date.now()}`;
    const assistantStub: ChatNachricht = {
      id: assistantTempId,
      konversation_id: konversationId,
      rolle: "assistant",
      inhalt: "",
      tools: [],
      aktion: null,
      erstellt_am: new Date().toISOString(),
    };

    setEingabe("");
    setNachrichten((prev) => [...prev, userNachricht, assistantStub]);
    setStreamendeId(assistantTempId);

    // Sidebar-Eintrag: Vorschau + Auto-Titel-Vorschlag aktualisieren.
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
      // Token-Stream konsumieren.
      for await (const chunk of sendeNachrichtStream(konversationId, text)) {
        setNachrichten((prev) =>
          prev.map((n) =>
            n.id === assistantTempId
              ? { ...n, inhalt: n.inhalt + chunk }
              : n,
          ),
        );
      }
      // Stream fertig — komplette Nachrichten-Liste neu laden, damit
      // Tool-Badges + ggf. Aktions-Vorschlag erscheinen und die echten DB-IDs
      // ankommen (statt der temporaeren "temp-…"-IDs).
      const echteListe = await holeNachrichtenApi(konversationId);
      setNachrichten(echteListe);
      // Aktualisiere die Konversations-Liste — Backend hat ggf. einen
      // Auto-Titel gesetzt.
      try {
        const res = await fetch("/api/chat/konversationen");
        if (res.ok) {
          const json = (await res.json()) as { konversationen: ChatKonversation[] };
          setKonversationen(json.konversationen);
        }
      } catch {
        // Best-effort — bestehende Liste reicht.
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Antwort fehlgeschlagen: ${msg}`);
      setNachrichten((prev) =>
        prev.map((n) =>
          n.id === assistantTempId
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
