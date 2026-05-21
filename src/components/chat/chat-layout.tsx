"use client";

// PROJ-17 — Zwei-Spalten-Layout fuer den Chat-Bereich.
//
// Desktop (>= md):   Konversationsliste links (max 320 px breit, fixe Breite),
//                    Verlauf rechts (fluid).
// Mobile (< md):     Schichtung — die Ansicht zeigt eine Spalte voll,
//                    der Topbar-Toggle wechselt zwischen "Liste" und "Chat".
//                    Wir behalten die Liste im DOM (kein Remount), damit
//                    Scrollposition + Streaming nicht verlieren gehen.

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  sidebar: React.ReactNode;
  /**
   * Empfaengt den Mobile-Toggle-Button als Render-Prop, damit der Header
   * der KonversationsAnsicht ihn an der richtigen Stelle einsetzen kann.
   */
  ansicht: (mobilZurueckButton: React.ReactNode) => React.ReactNode;
  /** Welche Spalte auf Mobile sichtbar ist. */
  mobilAnsicht: "liste" | "ansicht";
  setMobilAnsicht: (a: "liste" | "ansicht") => void;
}

export function ChatLayout({
  sidebar,
  ansicht,
  mobilAnsicht,
  setMobilAnsicht,
}: Props) {
  const mobilZurueckButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setMobilAnsicht("liste")}
      aria-label="Zurück zur Chat-Liste"
      className="md:hidden"
    >
      <Menu className="h-4 w-4" />
    </Button>
  );

  return (
    // Container: nimmt die Hoehe vom Eltern-Layout (App-Shell hat
    // overflow-hidden + h-screen, also brauchen wir hier h-full).
    <div className="flex h-full min-h-[600px] overflow-hidden rounded-lg border bg-card">
      {/* Linke Spalte */}
      <aside
        aria-label="Konversationen"
        className={cn(
          "w-full shrink-0 border-r md:w-[300px] lg:w-[320px]",
          mobilAnsicht === "liste" ? "block" : "hidden md:block",
        )}
      >
        {sidebar}
      </aside>

      {/* Rechte Spalte */}
      <section
        aria-label="Aktiver Chat"
        className={cn(
          "min-w-0 flex-1",
          mobilAnsicht === "ansicht" ? "block" : "hidden md:block",
        )}
      >
        {ansicht(mobilZurueckButton)}
      </section>
    </div>
  );
}
