"use client";

// PROJ-17 — Linke Spalte: Liste der Konversationen.
// Header mit "+ Neuer Chat", eine vertikal scrollbare Liste, Empty- und
// Loading-States. Hover-Aktionen via Drei-Punkte-Menue (Umbenennen +
// Loeschen mit Bestaetigungs-Dialog).

import { useState } from "react";
import {
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { relativesDatum } from "@/lib/chat/datum";
import type { ChatKonversation } from "@/lib/chat/typen";

interface Props {
  konversationen: ChatKonversation[];
  aktiveId: string | null;
  laedt: boolean;
  onWaehlen: (id: string) => void;
  onNeu: () => Promise<void> | void;
  onUmbenennen: (id: string, neuerTitel: string) => Promise<void> | void;
  onLoeschen: (id: string) => Promise<void> | void;
}

export function KonversationsListe({
  konversationen,
  aktiveId,
  laedt,
  onWaehlen,
  onNeu,
  onUmbenennen,
  onLoeschen,
}: Props) {
  const [neuBusy, setNeuBusy] = useState(false);
  const [umbenennen, setUmbenennen] = useState<ChatKonversation | null>(null);
  const [umbenennenTitel, setUmbenennenTitel] = useState("");
  const [umbenennenBusy, setUmbenennenBusy] = useState(false);
  const [loeschen, setLoeschen] = useState<ChatKonversation | null>(null);
  const [loeschenBusy, setLoeschenBusy] = useState(false);

  async function neueKonversation() {
    setNeuBusy(true);
    try {
      await onNeu();
    } finally {
      setNeuBusy(false);
    }
  }

  async function bestaetigeUmbenennen() {
    if (!umbenennen) return;
    const titel = umbenennenTitel.trim();
    if (!titel) return;
    setUmbenennenBusy(true);
    try {
      await onUmbenennen(umbenennen.id, titel);
      setUmbenennen(null);
    } finally {
      setUmbenennenBusy(false);
    }
  }

  async function bestaetigeLoeschen() {
    if (!loeschen) return;
    setLoeschenBusy(true);
    try {
      await onLoeschen(loeschen.id);
      setLoeschen(null);
    } finally {
      setLoeschenBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <Button
          onClick={neueKonversation}
          disabled={neuBusy}
          className="w-full justify-start gap-2"
          size="sm"
        >
          {neuBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquarePlus className="h-4 w-4" />
          )}
          Neuer Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {laedt ? (
            <SkeletonListe />
          ) : konversationen.length === 0 ? (
            <LeerZustand />
          ) : (
            <ul className="space-y-1" aria-label="Konversationen">
              {konversationen.map((k) => (
                <li key={k.id}>
                  <KonversationsEintrag
                    konversation={k}
                    aktiv={k.id === aktiveId}
                    onWaehlen={() => onWaehlen(k.id)}
                    onUmbenennen={() => {
                      setUmbenennen(k);
                      setUmbenennenTitel(k.titel);
                    }}
                    onLoeschen={() => setLoeschen(k)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </ScrollArea>

      {/* Umbenennen-Dialog */}
      <Dialog
        open={umbenennen !== null}
        onOpenChange={(o) => {
          if (!o && !umbenennenBusy) setUmbenennen(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Chat umbenennen</DialogTitle>
            <DialogDescription>
              Wähle einen aussagekräftigen Titel — der hilft beim
              Wiederfinden.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={umbenennenTitel}
            onChange={(e) => setUmbenennenTitel(e.target.value)}
            placeholder="z. B. Software-Ausgaben Mai 2026"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                bestaetigeUmbenennen();
              }
            }}
            aria-label="Neuer Titel"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUmbenennen(null)}
              disabled={umbenennenBusy}
            >
              Abbrechen
            </Button>
            <Button
              onClick={bestaetigeUmbenennen}
              disabled={umbenennenBusy || !umbenennenTitel.trim()}
            >
              {umbenennenBusy ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loeschen-Bestaetigung */}
      <AlertDialog
        open={loeschen !== null}
        onOpenChange={(o) => {
          if (!o && !loeschenBusy) setLoeschen(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chat löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{loeschen?.titel}" wird mit allen Nachrichten endgültig
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

function KonversationsEintrag({
  konversation,
  aktiv,
  onWaehlen,
  onUmbenennen,
  onLoeschen,
}: {
  konversation: ChatKonversation;
  aktiv: boolean;
  onWaehlen: () => void;
  onUmbenennen: () => void;
  onLoeschen: () => void;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-md transition-colors",
        aktiv ? "bg-accent" : "hover:bg-accent/50",
      )}
    >
      <button
        type="button"
        onClick={onWaehlen}
        aria-current={aktiv ? "true" : undefined}
        className="block w-full px-3 py-2.5 pr-9 text-left"
      >
        <div className="truncate text-sm font-medium">
          {konversation.titel}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{relativesDatum(konversation.aktualisiert_am)}</span>
        </div>
        {konversation.vorschau ? (
          <div className="mt-0.5 truncate text-xs text-muted-foreground">
            {konversation.vorschau}
          </div>
        ) : null}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Aktionen"
            className={cn(
              "absolute right-1 top-1.5 h-7 w-7",
              "opacity-0 transition-opacity group-hover:opacity-100",
              "focus-visible:opacity-100 data-[state=open]:opacity-100",
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onUmbenennen}>
            <Pencil className="mr-2 h-4 w-4" />
            Umbenennen
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={onLoeschen}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Löschen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SkeletonListe() {
  return (
    <div className="space-y-2 p-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-1.5 rounded-md p-2">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-2.5 w-1/3" />
          <Skeleton className="h-2.5 w-full" />
        </div>
      ))}
    </div>
  );
}

function LeerZustand() {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <Sparkles className="mb-3 h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">Noch keine Chats</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Leg einen Chat an, um Fragen zu deinen Buchungen zu stellen.
      </p>
    </div>
  );
}
