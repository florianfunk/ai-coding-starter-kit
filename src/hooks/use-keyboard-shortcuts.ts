"use client";

import { useEffect } from "react";

export interface KeyboardShortcut {
  /** The key to listen for, e.g. "s", "n", "Escape", "?" */
  key: string;
  /** Whether Cmd (Mac) / Ctrl (Windows) must be held */
  meta?: boolean;
  /** Handler function */
  handler: () => void;
  /**
   * If true (default), shortcut is ignored when an input, textarea,
   * or contenteditable element is focused.
   * Cmd+S and Escape always fire regardless of this setting.
   */
  ignoreInputs?: boolean;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const metaPressed = event.metaKey || event.ctrlKey;

      for (const shortcut of shortcuts) {
        const keyMatch =
          event.key.toLowerCase() === shortcut.key.toLowerCase();
        const metaMatch = shortcut.meta ? metaPressed : !metaPressed;

        if (!keyMatch || !metaMatch) continue;

        // Determine if we should ignore because an input is focused
        const ignoreInputs = shortcut.ignoreInputs ?? true;
        const alwaysFire =
          (shortcut.meta && shortcut.key.toLowerCase() === "s") ||
          shortcut.key === "Escape";

        if (ignoreInputs && isInputFocused() && !alwaysFire) continue;

        event.preventDefault();
        shortcut.handler();
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}
