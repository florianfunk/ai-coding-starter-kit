"use client";

// PROJ-17 — Beispielfragen-Bubbles fuer den Leerzustand einer frisch
// erstellten Konversation. Klick auf eine Bubble fuellt das Eingabefeld
// vor (kein automatisches Absenden — bewusst, damit der User noch
// anpassen kann).

import { Button } from "@/components/ui/button";
import { mockBeispielfragen } from "@/lib/chat/mock-daten";

interface Props {
  onSelect: (frage: string) => void;
}

export function BeispielfragenBubbles({ onSelect }: Props) {
  // TODO Backend: Beispielfragen kommen langfristig moeglicherweise aus
  // einer profil-basierten Empfehlung. Vorerst Hardcoded-Liste aus
  // /lib/chat/mock-daten.
  const fragen = mockBeispielfragen();
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-2 sm:grid-cols-2">
      {fragen.map((f) => (
        <Button
          key={f}
          variant="outline"
          onClick={() => onSelect(f)}
          className="h-auto justify-start whitespace-normal px-3 py-3 text-left text-sm font-normal leading-snug"
        >
          {f}
        </Button>
      ))}
    </div>
  );
}
