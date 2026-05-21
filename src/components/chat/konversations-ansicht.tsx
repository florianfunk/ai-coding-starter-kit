"use client";

// PROJ-17 — Rechte Spalte: aktive Konversation.
//
// Header (Titel + Loeschen-Icon), Nachrichten-Liste in ScrollArea, sticky
// Eingabe-Bereich. Empty-State bei frisch erstellter Konversation:
// Sparkles-Icon + Ueberschrift + 6 Beispielfragen.

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageSquareText, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  ChatAktion,
  ChatKonversation,
  ChatNachricht,
} from "@/lib/chat/typen";
import { BeispielfragenBubbles } from "./beispielfragen-bubbles";
import { EingabeFeld } from "./eingabe-feld";
import { NachrichtenListe } from "./nachrichten-liste";

interface Props {
  konversation: ChatKonversation | null;
  nachrichten: ChatNachricht[];
  laedtNachrichten: boolean;
  streamendeId: string | null;
  eingabe: string;
  onEingabeChange: (v: string) => void;
  onSenden: () => void;
  onLoeschen: () => Promise<void> | void;
  onAktionStatusChange: (
    nachrichtId: string,
    nextAktion: ChatAktion,
  ) => void;
  /** Mobil: Toggle, um zur Konversationsliste zurueckzukehren. */
  mobilZurueckButton?: React.ReactNode;
}

export function KonversationsAnsicht({
  konversation,
  nachrichten,
  laedtNachrichten,
  streamendeId,
  eingabe,
  onEingabeChange,
  onSenden,
  onLoeschen,
  onAktionStatusChange,
  mobilZurueckButton,
}: Props) {
  const [loeschenOffen, setLoeschenOffen] = useState(false);
  const [loeschenBusy, setLoeschenBusy] = useState(false);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  // Auto-Scroll ans Ende, sobald sich der Inhalt der laufenden Nachricht
  // veraendert (oder eine neue Nachricht hinzukommt).
  useEffect(() => {
    const el = scrollViewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [nachrichten, streamendeId]);

  if (!konversation) {
    return <KeineKonversation />;
  }

  const istLeer = !laedtNachrichten && nachrichten.length === 0;

  async function bestaetigeLoeschen() {
    setLoeschenBusy(true);
    try {
      await onLoeschen();
      setLoeschenOffen(false);
    } finally {
      setLoeschenBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
        {mobilZurueckButton}
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {konversation.titel}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Konversation löschen"
          onClick={() => setLoeschenOffen(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </header>

      {/* Eigener Scroll-Container — die Radix-ScrollArea exponiert
          das Viewport-Ref nicht direkt. Hier brauchen wir es fuer
          Auto-Scroll waehrend des Streamings. */}
      <div ref={scrollViewportRef} className="flex-1 overflow-y-auto">
        {laedtNachrichten ? (
          <LadeIndikator />
        ) : istLeer ? (
          <LeerZustand onFrageWaehlen={onEingabeChange} />
        ) : (
          <NachrichtenListe
            nachrichten={nachrichten}
            konversationId={konversation.id}
            streamendeId={streamendeId}
            onAktionStatusChange={onAktionStatusChange}
          />
        )}
      </div>

      <EingabeFeld
        wert={eingabe}
        onChange={onEingabeChange}
        onSenden={onSenden}
        streamt={streamendeId !== null}
      />

      <AlertDialog
        open={loeschenOffen}
        onOpenChange={(o) => {
          if (!o && !loeschenBusy) setLoeschenOffen(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chat löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{konversation.titel}" wird mit allen Nachrichten endgültig
              entfernt. Bereits ausgeführte Aktionen bleiben in der Audit-
              Historie sichtbar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loeschenBusy}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={bestaetigeLoeschen}
              disabled={loeschenBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loeschenBusy ? "Löschen…" : "Löschen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LadeIndikator() {
  return (
    <div className="flex h-full items-center justify-center px-4 py-12">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Lade Konversation…
      </div>
    </div>
  );
}

function KeineKonversation() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <MessageSquareText className="mb-4 h-10 w-10 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Kein Chat ausgewählt</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Wähle links eine Konversation oder leg einen neuen Chat an, um Fragen
        zu deinen Buchungen zu stellen.
      </p>
    </div>
  );
}

function LeerZustand({
  onFrageWaehlen,
}: {
  onFrageWaehlen: (frage: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-12 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight">
        Frag mich etwas zu deinen Finanzen
      </h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Ich kenne deine Buchungen, Kategorien, Abos und Stammdaten. Stell eine
        Frage oder weise mich an, Buchungen umzubuchen, Kategorien anzulegen
        oder Lernregeln zu pflegen.
      </p>
      <div className="mt-6 w-full">
        <BeispielfragenBubbles onSelect={onFrageWaehlen} />
      </div>
    </div>
  );
}
