"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import {
  useKeyboardShortcuts,
  type KeyboardShortcut,
} from "@/hooks/use-keyboard-shortcuts";
import { ShortcutsHelp } from "./shortcuts-help";

/** Maps list routes to their "create new" counterparts */
const NEW_ELEMENT_ROUTES: Record<string, string> = {
  "/produkte": "/produkte/neu",
  "/bereiche": "/bereiche/neu",
  "/kategorien": "/kategorien/neu",
  "/icons": "/icons/neu",
};

function getNewRoute(): string | null {
  const path = window.location.pathname;
  // Exact match or path with query params (pathname won't have query)
  if (NEW_ELEMENT_ROUTES[path]) return NEW_ELEMENT_ROUTES[path];
  return null;
}

function submitActiveForm() {
  // Find the first visible form with a submit button
  const forms = document.querySelectorAll("form");
  for (const form of forms) {
    // Skip hidden forms
    if (form.offsetParent === null && !form.closest("[data-state='open']"))
      continue;

    const submitButton = form.querySelector<HTMLButtonElement>(
      'button[type="submit"], input[type="submit"]'
    );
    if (submitButton && !submitButton.disabled) {
      form.requestSubmit(submitButton);
      toast({
        title: "Wird gespeichert...",
        description: "Formular wird abgeschickt.",
      });
      return;
    }

    // If no explicit submit button, try requestSubmit on the form itself
    form.requestSubmit();
    toast({
      title: "Wird gespeichert...",
      description: "Formular wird abgeschickt.",
    });
    return;
  }
}

export function GlobalShortcuts() {
  const [helpOpen, setHelpOpen] = useState(false);
  const router = useRouter();

  const handleSave = useCallback(() => {
    submitActiveForm();
  }, []);

  const handleHelp = useCallback(() => {
    setHelpOpen((prev) => !prev);
  }, []);

  const handleNew = useCallback(() => {
    const route = getNewRoute();
    if (route) {
      router.push(route);
    }
  }, [router]);

  const shortcuts: KeyboardShortcut[] = useMemo(
    () => [
      {
        key: "s",
        meta: true,
        handler: handleSave,
        ignoreInputs: false, // Cmd+S always fires
      },
      {
        key: "?",
        meta: false,
        handler: handleHelp,
        ignoreInputs: true,
      },
      {
        key: "n",
        meta: false,
        handler: handleNew,
        ignoreInputs: true,
      },
    ],
    [handleSave, handleHelp, handleNew]
  );

  useKeyboardShortcuts(shortcuts);

  return <ShortcutsHelp open={helpOpen} onOpenChange={setHelpOpen} />;
}
