"use client";

// PROJ-22: Globaler Jahres-Kontext.
// Hält das aktive Jahr (number | null = "Alle Jahre") + die wählbaren Jahre.
// `setJahr` persistiert serverseitig (PATCH) und lädt die Server-Daten neu.

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AktivesJahr } from "@/lib/jahr/aktives-jahr";

interface JahrContextWert {
  aktivesJahr: AktivesJahr;
  verfuegbareJahre: number[];
  /** true während Persistieren/Reload läuft. */
  pending: boolean;
  setJahr: (jahr: AktivesJahr) => void;
}

const JahrContext = createContext<JahrContextWert | null>(null);

export function JahrProvider({
  initialAktivesJahr,
  verfuegbareJahre,
  children,
}: {
  initialAktivesJahr: AktivesJahr;
  verfuegbareJahre: number[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [aktivesJahr, setAktivesJahr] = useState<AktivesJahr>(initialAktivesJahr);
  const [pending, startTransition] = useTransition();

  const setJahr = useCallback(
    (jahr: AktivesJahr) => {
      const vorher = aktivesJahr;
      if (jahr === vorher) return;
      setAktivesJahr(jahr); // optimistisch
      startTransition(async () => {
        try {
          const res = await fetch("/api/firma/jahr", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aktives_jahr: jahr }),
          });
          if (!res.ok) {
            const j = (await res.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(j?.error ?? "Jahr konnte nicht gespeichert werden.");
          }
          // Server-Komponenten + alle Datenabrufe auf das neue Jahr neu laden.
          router.refresh();
        } catch (e) {
          setAktivesJahr(vorher); // Rollback
          toast.error(
            e instanceof Error ? e.message : "Jahr konnte nicht gespeichert werden.",
          );
        }
      });
    },
    [aktivesJahr, router],
  );

  return (
    <JahrContext.Provider
      value={{ aktivesJahr, verfuegbareJahre, pending, setJahr }}
    >
      {children}
    </JahrContext.Provider>
  );
}

/** Liest den globalen Jahres-Kontext. Wirft außerhalb des Providers. */
export function useJahr(): JahrContextWert {
  const ctx = useContext(JahrContext);
  if (!ctx) {
    throw new Error("useJahr muss innerhalb von <JahrProvider> verwendet werden.");
  }
  return ctx;
}

/**
 * Wie useJahr, aber tolerant außerhalb des Providers (liefert „Alle Jahre").
 * Für Komponenten, die auch ohne App-Shell gerendert werden könnten.
 */
export function useJahrOptional(): JahrContextWert {
  const ctx = useContext(JahrContext);
  return (
    ctx ?? {
      aktivesJahr: null,
      verfuegbareJahre: [],
      pending: false,
      setJahr: () => {},
    }
  );
}
