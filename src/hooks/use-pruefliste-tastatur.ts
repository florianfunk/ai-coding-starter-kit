"use client";

// PROJ-26 (Feature 1): Keyboard-Triage für die Prüfliste. Bewegt einen Fokus-
// Cursor durch die gefilterte Fallliste und löst Aktionen aus — analog zu
// E-Mail-Triage. Die Listener sind nur aktiv, wenn kein Eingabefeld oder Dialog
// fokussiert ist, damit Filter/Suche und Dialoge ungestört bleiben.

import { useCallback, useEffect, useState } from "react";

export interface TastaturAktionen {
  /** Anzahl der aktuell sichtbaren Fälle (Länge der gefilterten Liste). */
  anzahl: number;
  /** Fokussierten Fall mit aktuellem Vorschlag akzeptieren/verbuchen. */
  onAkzeptieren: (index: number) => void;
  /** Klassifikation des fokussierten Falls lokal setzen (optimistisch). */
  onKlassifikation: (
    index: number,
    klass: "geschaeftlich" | "privat" | "neutral",
  ) => void;
  /** Entscheidungs-Dialog für den fokussierten Fall öffnen. */
  onEntscheiden: (index: number) => void;
  /** Hilfe-Overlay öffnen. */
  onHilfe: () => void;
  /** Hilfe-Overlay schließen (Esc). */
  onEscape: () => void;
  /**
   * True, wenn aktuell ein Dialog/Sheet/Overlay offen ist. Dann sind die
   * Listen-Shortcuts deaktiviert (außer der parent reicht das selbst weiter).
   */
  blockiert: boolean;
}

function eingabeAktiv(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  // Radix-Comboboxen / Select-Trigger im offenen Zustand.
  if (el.getAttribute("role") === "combobox") return true;
  return false;
}

export function usePrueflisteTastatur(aktionen: TastaturAktionen) {
  const { anzahl, blockiert } = aktionen;
  const [rohIndex, setFokusIndex] = useState(-1);

  // Fokus beim Rendern an die aktuelle Listenlänge klemmen, ohne State-Update
  // im Effekt: schrumpft die Liste, bleibt der Cursor im gültigen Bereich.
  const fokusIndex =
    anzahl === 0 ? -1 : Math.min(rohIndex, anzahl - 1);

  // Aktive Zeile in den sichtbaren Bereich scrollen.
  useEffect(() => {
    if (fokusIndex < 0) return;
    const el = document.querySelector<HTMLElement>(
      `[data-fokus-index="${fokusIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [fokusIndex]);

  const bewege = useCallback(
    (delta: number) => {
      if (anzahl === 0) {
        setFokusIndex(-1);
        return;
      }
      const ziel =
        fokusIndex < 0 ? (delta > 0 ? 0 : anzahl - 1) : fokusIndex + delta;
      setFokusIndex(Math.max(0, Math.min(anzahl - 1, ziel)));
    },
    [anzahl, fokusIndex],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // "?" und Esc dürfen auch greifen, wenn kein Fokus gesetzt ist — aber nie,
      // während der Nutzer in einem Feld tippt oder ein Dialog offen ist.
      if (eingabeAktiv()) return;

      if (e.key === "Escape") {
        aktionen.onEscape();
        setFokusIndex(-1);
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        aktionen.onHilfe();
        return;
      }

      // Listen-Shortcuts pausieren, solange ein Overlay/Dialog offen ist.
      if (blockiert) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          bewege(1);
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          bewege(-1);
          break;
        case "Enter":
        case "a":
          if (fokusIndex >= 0) {
            e.preventDefault();
            aktionen.onAkzeptieren(fokusIndex);
          }
          break;
        case "g":
          if (fokusIndex >= 0)
            aktionen.onKlassifikation(fokusIndex, "geschaeftlich");
          break;
        case "p":
          if (fokusIndex >= 0) aktionen.onKlassifikation(fokusIndex, "privat");
          break;
        case "n":
          if (fokusIndex >= 0) aktionen.onKlassifikation(fokusIndex, "neutral");
          break;
        case "e":
          if (fokusIndex >= 0) {
            e.preventDefault();
            aktionen.onEntscheiden(fokusIndex);
          }
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aktionen, blockiert, bewege, fokusIndex]);

  return { fokusIndex, setFokusIndex };
}
