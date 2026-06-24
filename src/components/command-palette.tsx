"use client";

// PROJ-29: Globale Command-Palette (⌘K / Strg+K).
// PROJ-34: + globale Volltextsuche über /api/suche (Buchungen & Empfänger).
//
// Diese Komponente rendert BEIDES selbst:
//   1. einen dezenten Topbar-Trigger-Button (AC6) — damit das Layout
//      server-seitig bleiben kann und nur <CommandPalette/> einhängen muss.
//   2. den CommandDialog (AC1/AC2/AC4/AC5).
//
// Datenquelle der Seiten-Navigation: src/lib/navigation.ts (geteilt mit der
// Sidebar). Jahr-Wechsel nutzt den vorhandenen JahrProvider-Context (Setter
// heißt `setJahr`, aktives Jahr ist `aktivesJahr: number | null`).
//
// PROJ-34 — shouldFilter-Entscheidung:
//   Die Server-Treffer sind bereits gematcht; cmdk würde sie clientseitig
//   nochmal gegen die Eingabe filtern und je nach value teils wegfiltern.
//   Deshalb läuft der Dialog mit `shouldFilter={false}`. Konsequenz: die
//   STATISCHEN Items (Navigation/Aktionen/Jahr) müssen wir selbst filtern,
//   sonst stünden sie immer komplett da. Das passiert über `passt()` per
//   Substring-Match auf der Eingabe — günstig und vorhersehbar.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ArrowRight,
  Zap,
  CalendarRange,
  Check,
  Receipt,
  Users,
  Loader2,
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
import {
  MIN_QUERY_LEN,
  type SucheResponse,
  type SucheBuchungDTO,
  type SucheEmpfaengerDTO,
} from "@/lib/suche/suche";

// AC4 — Schnell-Aktionen. In v1 reine Navigation zum jeweiligen Ziel.
const AKTIONEN: { label: string; href: string }[] = [
  { label: "Klassifizierung starten", href: "/klassifizierung" },
  { label: "Import öffnen", href: "/einstellungen/konten/import" },
  { label: "Paperless-Sync", href: "/einstellungen/paperless" },
  { label: "Prüfliste öffnen", href: "/pruefliste" },
  { label: "Export öffnen", href: "/export" },
];

// PROJ-34 — Debounce für die Server-Suche.
const DEBOUNCE_MS = 220;

const EUR = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const DATUM = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

function formatDatum(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : DATUM.format(d);
}

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

  // PROJ-34 — Eingabe + Server-Suchergebnisse.
  const [eingabe, setEingabe] = useState("");
  const [treffer, setTreffer] = useState<SucheResponse>({
    buchungen: [],
    empfaenger: [],
  });
  const [ladend, setLadend] = useState(false);
  // Aktuell laufender Request — wird bei neuer Eingabe abgebrochen (AC4).
  const abortRef = useRef<AbortController | null>(null);

  // AC1 — Globaler Hotkey ⌘K (Mac) / Strg+K (Win/Linux), togglet die Palette.
  // Wir prevent-defaulten NUR beim eigenen Hotkey, damit keine bestehenden
  // Shortcuts brechen. Während ein Eingabefeld den Fokus hat, greift der Hotkey
  // bewusst NICHT — gleiches Muster wie use-pruefliste-tastatur.ts. Wenn die
  // Palette bereits offen ist, soll ⌘K trotzdem togglen (ihr eigener
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
      if (istEingabe && !offenRef.current) return;
      e.preventDefault();
      setOffen((o) => !o);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // PROJ-34 — debounced Server-Suche mit AbortController. Veraltete Requests
  // werden verworfen, damit keine alten Ergebnisse über neue flackern (AC4).
  useEffect(() => {
    const q = eingabe.trim();

    // Laufenden Request immer abbrechen, sobald sich die Eingabe ändert.
    abortRef.current?.abort();

    const handle = window.setTimeout(() => {
      // Unter Mindestlänge: kein teurer Query — Treffer asynchron leeren.
      if (q.length < MIN_QUERY_LEN) {
        setTreffer({ buchungen: [], empfaenger: [] });
        setLadend(false);
        return;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLadend(true);
      fetch(`/api/suche?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Suche"))))
        .then((data: SucheResponse) => {
          setTreffer({
            buchungen: data.buchungen ?? [],
            empfaenger: data.empfaenger ?? [],
          });
          setLadend(false);
        })
        .catch((err: unknown) => {
          // Abbruch ist erwartet (neue Eingabe) — kein Fehlerzustand.
          if (err instanceof DOMException && err.name === "AbortError") return;
          setTreffer({ buchungen: [], empfaenger: [] });
          setLadend(false);
        });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [eingabe]);

  // Beim Schließen Eingabe + Treffer zurücksetzen, damit der nächste Aufruf
  // sauber startet (kein altes Ergebnis beim Wiederöffnen).
  const handleOpenChange = useCallback((next: boolean) => {
    setOffen(next);
    if (!next) {
      abortRef.current?.abort();
      setEingabe("");
      setTreffer({ buchungen: [], empfaenger: [] });
      setLadend(false);
    }
  }, []);

  // Navigiert und schließt die Palette.
  const gehe = useCallback(
    (href: string) => {
      handleOpenChange(false);
      router.push(href);
    },
    [router, handleOpenChange],
  );

  // AC5 — Jahr wechseln über den vorhandenen Context-Setter.
  const waehleJahr = useCallback(
    (jahr: number) => {
      handleOpenChange(false);
      setJahr(jahr);
    },
    [setJahr, handleOpenChange],
  );

  // PROJ-34 — Sprungziele:
  //   Buchung   → /buchungen?q=<Empfänger|Text> (vorausgefüllte Volltextsuche
  //               der bestehenden Buchungsliste; springt zur passenden Zeile).
  //   Empfänger → /buchungen?q=<Empfänger> (gefilterte Buchungsansicht des
  //               Empfängers — keine eigene Empfänger-Detailseite vorhanden).
  const geheZuBuchung = useCallback(
    (b: SucheBuchungDTO) => {
      const q = (b.empfaenger ?? b.verwendungszweck ?? "").trim();
      gehe(q ? `/buchungen?q=${encodeURIComponent(q)}` : "/buchungen");
    },
    [gehe],
  );
  const geheZuEmpfaenger = useCallback(
    (e: SucheEmpfaengerDTO) => {
      gehe(`/buchungen?q=${encodeURIComponent(e.name || e.normalisiert)}`);
    },
    [gehe],
  );

  // PROJ-34 — Substring-Filter für die statischen Items, weil der Dialog mit
  // shouldFilter={false} läuft (cmdk filtert nicht mehr selbst). Leere Eingabe
  // → alles sichtbar (klassische Sprung-Navigation wie in PROJ-29).
  const q = eingabe.trim().toLowerCase();
  const passt = useCallback(
    (...felder: string[]) => {
      if (q.length === 0) return true;
      return felder.some((f) => f.toLowerCase().includes(q));
    },
    [q],
  );

  const navGefiltert = useMemo(
    () =>
      NAV_SEKTIONEN.map((sektion) => ({
        titel: sektion.titel,
        eintraege: sektion.eintraege.filter((e) => passt(e.label, e.href)),
      })).filter((s) => s.eintraege.length > 0),
    [passt],
  );
  const aktionenGefiltert = useMemo(
    () => AKTIONEN.filter((a) => passt(a.label, a.href)),
    [passt],
  );
  const jahreGefiltert = useMemo(
    () => verfuegbareJahre.filter((j) => passt(String(j), `jahr ${j}`)),
    [passt, verfuegbareJahre],
  );

  const hatServerTreffer =
    treffer.buchungen.length > 0 || treffer.empfaenger.length > 0;
  const hatStatisch =
    navGefiltert.length > 0 ||
    aktionenGefiltert.length > 0 ||
    jahreGefiltert.length > 0;
  // Empty-State: nur zeigen, wenn nichts gefunden UND nicht gerade lädt.
  const zeigeLeer = !ladend && !hatServerTreffer && !hatStatisch;

  return (
    <>
      {/* AC6 — dezenter Topbar-Trigger. Auf Mobil genügt der Hotkey; in der
          Topbar (hidden md:flex) erscheint der Button mit ⌘K-Hinweis. */}
      <button
        type="button"
        onClick={() => setOffen(true)}
        aria-label="Befehle, Seiten und Buchungen suchen (Strg/Cmd + K)"
        className="inline-flex h-8 items-center gap-2 rounded-[8px] border px-2.5 text-[12px] font-medium text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-2)] hover:text-foreground"
        style={{ borderColor: "var(--line)" }}
      >
        <Search className="h-3.5 w-3.5 opacity-70" />
        <span className="hidden lg:inline">Suchen…</span>
        <kbd className="pointer-events-none hidden items-center gap-0.5 rounded border bg-[color:var(--surface-2)] px-1.5 font-sans text-[10px] font-semibold tracking-wide lg:inline-flex">
          ⌘K
        </kbd>
      </button>

      <CommandDialog
        open={offen}
        onOpenChange={handleOpenChange}
        // PROJ-34 — Server-Treffer NICHT nochmal client-filtern.
        commandProps={{ shouldFilter: false }}
      >
        <CommandInput
          placeholder="Seite, Aktion, Buchung oder Empfänger suchen…"
          value={eingabe}
          onValueChange={setEingabe}
        />
        <CommandList>
          {zeigeLeer && <CommandEmpty>Nichts gefunden</CommandEmpty>}

          {/* PROJ-34 — Server-Treffer: Buchungen. */}
          {treffer.buchungen.length > 0 && (
            <CommandGroup heading="Buchungen">
              {treffer.buchungen.map((b) => (
                <CommandItem
                  key={b.id}
                  value={`buchung-${b.id}`}
                  onSelect={() => geheZuBuchung(b)}
                >
                  <Receipt className="opacity-50" />
                  <span className="truncate">
                    {b.empfaenger?.trim() ||
                      b.verwendungszweck?.trim() ||
                      "Ohne Empfänger"}
                  </span>
                  <CommandShortcut className="tracking-normal">
                    {formatDatum(b.buchung_datum)} · {EUR.format(b.betrag)}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* PROJ-34 — Server-Treffer: Empfänger (distinct). */}
          {treffer.empfaenger.length > 0 && (
            <CommandGroup heading="Empfänger">
              {treffer.empfaenger.map((e) => (
                <CommandItem
                  key={e.normalisiert}
                  value={`empfaenger-${e.normalisiert}`}
                  onSelect={() => geheZuEmpfaenger(e)}
                >
                  <Users className="opacity-50" />
                  <span className="truncate">{e.name}</span>
                  <CommandShortcut className="tracking-normal">
                    {e.anzahl} {e.anzahl === 1 ? "Buchung" : "Buchungen"}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* PROJ-34 — Ladeindikator während der Server-Suche. */}
          {ladend && !hatServerTreffer && (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Suche läuft…
            </div>
          )}

          {(hatServerTreffer || ladend) && hatStatisch && <CommandSeparator />}

          {/* Seiten-Navigation, gruppiert nach den 4 Sektionen. */}
          {navGefiltert.map((sektion) => (
            <CommandGroup key={sektion.titel} heading={sektion.titel}>
              {sektion.eintraege.map((eintrag) => (
                <CommandItem
                  key={eintrag.href}
                  value={`${eintrag.label} ${eintrag.href}`}
                  onSelect={() => gehe(eintrag.href)}
                >
                  <ArrowRight className="opacity-50" />
                  <span>{eintrag.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          {aktionenGefiltert.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Aktionen">
                {aktionenGefiltert.map((aktion) => (
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
            </>
          )}

          {/* AC5 — Jahr wechseln (nur wenn passende Jahre verfügbar sind). */}
          {jahreGefiltert.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Jahr wechseln">
                {jahreGefiltert.map((jahr) => {
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
