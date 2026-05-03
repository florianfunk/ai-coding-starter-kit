"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_PARAMETER, type WizardParameter } from "./types";

const STORAGE_KEY = "lichtengros.katalog-wizard.defaults";

function isWizardParameter(v: unknown): v is WizardParameter {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    (o.layout === "lichtengros" || o.layout === "eisenkeil") &&
    (o.preisauswahl === "lichtengros" || o.preisauswahl === "eisenkeil" || o.preisauswahl === "listenpreis") &&
    (o.preisAenderung === "plus" || o.preisAenderung === "minus") &&
    typeof o.preisProzent === "number" &&
    (o.waehrung === "EUR" || o.waehrung === "CHF") &&
    o.sprache === "de"
  );
}

export function useWizardDefaults() {
  const [parameter, setParameterState] = useState<WizardParameter>(DEFAULT_PARAMETER);
  const [hydrated, setHydrated] = useState(false);

  // Hydration aus localStorage — unvermeidbar setState-im-Effect, weil
  // localStorage nur clientseitig verfügbar ist.
  /* eslint-disable react-hooks/set-state-in-effect -- localStorage-Hydration */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isWizardParameter(parsed)) setParameterState(parsed);
      }
    } catch {
      // localStorage nicht verfügbar oder JSON kaputt — wir bleiben bei DEFAULT_PARAMETER
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const setParameter = useCallback((next: WizardParameter) => {
    setParameterState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // nichts zu tun — UI funktioniert weiter, nur Persistenz fällt aus
    }
  }, []);

  return { parameter, setParameter, hydrated };
}
