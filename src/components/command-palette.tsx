"use client";

// PROJ-29: Globale Command-Palette (⌘K / Strg+K).
//
// Diese Komponente rendert BEIDES selbst:
//   1. einen dezenten Topbar-Trigger-Button (AC6) — damit das Layout
//      server-seitig bleiben kann und nur <CommandPalette/> einhängen muss.
//   2. den CommandDialog (AC1/AC2/AC4/AC5).
//
// Datenquelle der Seiten-Navigation: src/lib/navigation.ts (AC3, geteilt mit
// der Sidebar). Jahr-Wechsel nutzt den vorhandenen JahrProvider-Context (AC5,
// Setter heißt `setJahr`, aktives Jahr ist `aktivesJahr: number | null`).

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowRight,
  Zap,
  CalendarRange,
  Check,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { NAV_SEKTIONEN } from "@/lib/navigation";
import { useJahr } from "@/components/jahr/jahr-provider";

// AC4 — Schnell-Aktionen. In v1 reine Navigation zum jeweiligen Ziel.
const AKTIONEN: { label: string; href: string }[] = [
  { label: "Klassifizierung starten", href: "/klassifizierung" },
  { label: "Import öffnen", href: "/einstellungen/konten/import" },
  { label: "Paperless-Sync", href: "/einstellungen/paperless" },
  { label: "Prüfliste öffnen", href: "/pruefliste" },
  { label: "Export öffnen", href: "/export" },
];

export function CommandPalette() {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  // Spiegelt `offen` für den keydown-Listener (Empty-Deps-Closure würde sonst
  // einen veralteten Wert sehen). Sync im Effekt, nicht im Render.
  const offenRef = useRef(offen);
  useEffect(() => {
    offenRef.current = offen;
  }, [offen]);
  const { aktivesJahr, verfuegbareJahre, setJahr } = useJahr();

  // AC1 — Globaler Hotkey ⌘K (Mac) / Strg+K (Win/Linux), togglet die Palette.
  // Wir prevent-defaulten NUR beim eigenen Hotkey, damit keine bestehenden
  // Shortcuts brechen. Während ein Eingabefeld den Fokus hat, greift der Hotkey
  // bewusst NICHT (Spec AC1) — gleiches Muster wie use-pruefliste-tastatur.ts.
  // Wenn die Palette bereits offen ist, soll ⌘K trotzdem togglen (ihr eigener
  // CommandInput zählt nicht als Sperre).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName ?? "";
      const istEingabe =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable === true;
      // Eingabefeld fokussiert UND Palette zu → Hotkey ignorieren (Spec AC1).
      // Ist die Palette offen, ist das fokussierte Feld ihr eigener
      // CommandInput — dann darf ⌘K weiterhin togglen/schließen.
      if (istEingabe && !offenRef.current) return;
      e.preventDefault();
      setOffen((o) => !o);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Navigiert und schließt die Palette (AC2/AC4).
  const gehe = useCallback(
    (href: string) => {
      setOffen(false);
      router.push(href);
    },
    [router],
  );

  // AC5 — Jahr wechseln über den vorhandenen Context-Setter.
  const waehleJahr = useCallback(
    (jahr: number) => {
      setOffen(false);
      setJahr(jahr);
    },
    [setJahr],
  );

  return (
    <>
      {/* AC6 — dezenter Topbar-Trigger. Auf Mobil genügt der Hotkey; in der
          Topbar (hidden md:flex) erscheint der Button mit ⌘K-Hinweis. */}
      <button
        type="button"
        onClick={() => setOffen(true)}
        aria-label="Befehle und Seiten suchen (Strg/Cmd + K)"
        className="inline-flex h-8 items-center gap-2 rounded-[8px] border px-2.5 text-[12px] font-medium text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-2)] hover:text-foreground"
        style={{ borderColor: "var(--line)" }}
      >
        <Search className="h-3.5 w-3.5 opacity-70" />
        <span className="hidden lg:inline">Suchen…</span>
        <kbd className="pointer-events-none hidden items-center gap-0.5 rounded border bg-[color:var(--surface-2)] px-1.5 font-sans text-[10px] font-semibold tracking-wide lg:inline-flex">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={offen} onOpenChange={setOffen}>
        <CommandInput placeholder="Seite oder Aktion suchen…" />
        <CommandList>
          <CommandEmpty>Nichts gefunden</CommandEmpty>

          {/* AC2 — Seiten-Navigation, gruppiert nach den 4 Sektionen. */}
          {NAV_SEKTIONEN.map((sektion) => (
            <CommandGroup key={sektion.titel} heading={sektion.titel}>
              {sektion.eintraege.map((eintrag) => (
                <CommandItem
                  key={eintrag.href}
                  // value mit Label + href, damit die Fuzzy-Suche zuverlässig greift.
                  value={`${eintrag.label} ${eintrag.href}`}
                  onSelect={() => gehe(eintrag.href)}
                >
                  <ArrowRight className="opacity-50" />
                  <span>{eintrag.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          <CommandSeparator />

          {/* AC4 — Schnell-Aktionen. */}
          <CommandGroup heading="Aktionen">
            {AKTIONEN.map((aktion) => (
              <CommandItem
                key={aktion.label}
                value={`Aktion ${aktion.label}`}
                onSelect={() => gehe(aktion.href)}
              >
                <Zap className="opacity-50" />
                <span>{aktion.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          {/* AC5 — Jahr wechseln (nur wenn Jahre verfügbar sind). */}
          {verfuegbareJahre.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Jahr wechseln">
                {verfuegbareJahre.map((jahr) => {
                  const aktiv = aktivesJahr === jahr;
                  return (
                    <CommandItem
                      key={jahr}
                      value={`Jahr ${jahr}`}
                      onSelect={() => waehleJahr(jahr)}
                    >
                      <CalendarRange className="opacity-50" />
                      <span>Jahr {jahr}</span>
                      {aktiv && (
                        <CommandShortcut className="flex items-center gap-1 tracking-normal">
                          <Check className="h-3.5 w-3.5" />
                          Aktiv
                        </CommandShortcut>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
