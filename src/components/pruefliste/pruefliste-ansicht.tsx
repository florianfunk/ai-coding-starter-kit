"use client";

// PROJ-7: Prüflisten-Ansicht. Fall-Liste mit Grund-Badge, Filter/Sortierung,
// Mustergruppierung (gleicher Empfänger), Bulk-Auswahl und Einzel-/Bulk-
// Entscheidung. Nach einer Regel-Anlage wird angeboten, gleichartige offene
// Fälle direkt mitzuerledigen.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Info,
  Keyboard,
  Layers,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { Buchung, Kategorie, Klassifikation, Konto } from "@/lib/types";
import { BuchungDetailSheet } from "@/components/buchungen/buchung-detail-sheet";
import { KategorieCombobox } from "@/components/kategorien/kategorie-combobox";
import { MerkenStern } from "@/components/merkliste/merken-stern";
import { useMerkSet } from "@/hooks/use-merk-set";
import { useReklassifizierung } from "@/hooks/use-reklassifizierung";
import { usePrueflisteTastatur } from "@/hooks/use-pruefliste-tastatur";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EntscheidungsDialog,
  type EntscheidungErgebnis,
} from "./entscheidungs-dialog";
import { PrueflisteBegruendung } from "./pruefliste-begruendung";
import { formatBetrag, formatDatum, gruendeListe, grundLabel } from "./labels";

interface Mustergruppe {
  schluessel: string;
  empfaenger: string;
  buchung_ids: string[];
}

function normEmpfaenger(value: string | null): string {
  return (value ?? "").toLowerCase().trim();
}

type SortFeld = "datum" | "betrag" | "empfaenger" | "konfidenz";
type KlassFilter = "alle" | Klassifikation;
// "alle" = egal, "ohne" = keine Kategorie gesetzt, sonst eine kategorie_id.
type KategorieFilter = "alle" | "ohne" | string;

const KLASS_FILTER_LABEL: Record<KlassFilter, string> = {
  alle: "Alle Klassifikationen",
  geschaeftlich: "Geschäftlich",
  privat: "Privat",
  unklar: "Unklar",
  neutral: "Neutral",
};

const SORT_LABEL: Record<SortFeld, string> = {
  datum: "Nach Datum",
  betrag: "Nach Betrag",
  empfaenger: "Empfänger A–Z",
  konfidenz: "Nach Konfidenz",
};

// Betragsfeld → Zahl (Komma erlaubt) oder null, wenn leer/ungültig.
function parseBetrag(value: string): number | null {
  const s = value.trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function PrueflisteAnsicht({
  initialFaelle,
  konten,
  kategorien,
}: {
  initialFaelle: Buchung[];
  konten: Konto[];
  kategorien: Kategorie[];
}) {
  const router = useRouter();
  const { reklassifiziere, pending: reklassPending } = useReklassifizierung();
  const [faelle, setFaelle] = useState<Buchung[]>(initialFaelle);
  // PROJ-20: Merken unabhängig vom Entscheiden — eine Buchung kann in der
  // Prüfliste bleiben und trotzdem gemerkt sein.
  const merk = useMerkSet(
    initialFaelle.filter((f) => f.gemerkt_am !== null).map((f) => f.id),
  );
  const [konto, setKonto] = useState("alle");
  const [grund, setGrund] = useState("alle");
  const [sort, setSort] = useState<SortFeld>("datum");
  const [suche, setSuche] = useState("");
  const [klassFilter, setKlassFilter] = useState<KlassFilter>("alle");
  const [kategorieFilter, setKategorieFilter] = useState<KategorieFilter>("alle");
  const [betragVon, setBetragVon] = useState("");
  const [betragBis, setBetragBis] = useState("");
  const [empfaengerFilter, setEmpfaengerFilter] = useState<string | null>(null);
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [dialogFaelle, setDialogFaelle] = useState<Buchung[] | null>(null);
  // Detail-Ansicht (read-only) einer einzelnen Buchung – Begründung, Konfidenz,
  // Quelle, Audit-Trail und Empfänger-Wissen.
  const [detailFall, setDetailFall] = useState<Buchung | null>(null);
  const [reloading, setReloading] = useState(false);
  const [nachregel, setNachregel] = useState<{
    anzahl: number;
    regelName: string;
  } | null>(null);
  // PROJ-26: Keyboard-Triage — Hilfe-Overlay + laufendes Akzeptieren.
  const [hilfeOffen, setHilfeOffen] = useState(false);
  const [akzeptierePending, setAkzeptierePending] = useState(false);

  const kontoName = (id: string) =>
    konten.find((k) => k.id === id)?.bezeichnung ?? "—";

  const verfuegbareGruende = useMemo(() => {
    const s = new Set<string>();
    for (const f of faelle) {
      for (const g of gruendeListe(f.pruef_grund)) s.add(g);
    }
    return Array.from(s).sort();
  }, [faelle]);

  // Basis = alle Filter (Konto, Grund, Suche, Klassifikation, Kategorie-Status,
  // Betrag-Bereich) + Sortierung. Die Mustergruppen werden hieraus gebildet,
  // damit die Empfänger-Chips konsistent zur gefilterten Menge bleiben.
  const basis = useMemo(() => {
    const q = suche.trim().toLowerCase();
    const von = parseBetrag(betragVon);
    const bis = parseBetrag(betragBis);
    // Von/Bis können vertauscht eingegeben werden – Grenzen normalisieren.
    const min = von !== null && bis !== null ? Math.min(von, bis) : von;
    const max = von !== null && bis !== null ? Math.max(von, bis) : bis;

    let liste = faelle.filter((f) => {
      if (konto !== "alle" && f.konto_id !== konto) return false;
      if (grund !== "alle" && !gruendeListe(f.pruef_grund).includes(grund)) {
        return false;
      }
      if (klassFilter !== "alle" && f.klassifikation !== klassFilter) {
        return false;
      }
      if (kategorieFilter === "ohne") {
        if (f.kategorie_id !== null) return false;
      } else if (kategorieFilter !== "alle" && f.kategorie_id !== kategorieFilter) {
        return false;
      }
      const abs = Math.abs(f.betrag);
      if (min !== null && abs < min) return false;
      if (max !== null && abs > max) return false;
      if (q) {
        const heu = `${f.empfaenger ?? ""} ${f.verwendungszweck ?? ""}`.toLowerCase();
        if (!heu.includes(q)) return false;
      }
      return true;
    });

    liste = liste.sort((a, b) => {
      switch (sort) {
        case "betrag":
          return Math.abs(b.betrag) - Math.abs(a.betrag);
        case "empfaenger":
          return normEmpfaenger(a.empfaenger).localeCompare(
            normEmpfaenger(b.empfaenger),
          );
        case "konfidenz":
          // Unsicherste zuerst: aufsteigend, null ("KI nicht verfügbar") ganz oben.
          return (a.konfidenz ?? -1) - (b.konfidenz ?? -1);
        default:
          return b.buchung_datum.localeCompare(a.buchung_datum);
      }
    });
    return liste;
  }, [
    faelle,
    konto,
    grund,
    sort,
    suche,
    klassFilter,
    kategorieFilter,
    betragVon,
    betragBis,
  ]);

  const filterAktiv =
    konto !== "alle" ||
    grund !== "alle" ||
    klassFilter !== "alle" ||
    kategorieFilter !== "alle" ||
    suche.trim() !== "" ||
    betragVon.trim() !== "" ||
    betragBis.trim() !== "";

  function filterZuruecksetzen() {
    setKonto("alle");
    setGrund("alle");
    setKlassFilter("alle");
    setKategorieFilter("alle");
    setSuche("");
    setBetragVon("");
    setBetragBis("");
    setEmpfaengerFilter(null);
    setAuswahl(new Set());
  }

  const gruppen = useMemo<Mustergruppe[]>(() => {
    const map = new Map<string, Mustergruppe>();
    for (const f of basis) {
      const key = normEmpfaenger(f.empfaenger);
      if (!key) continue;
      const g = map.get(key);
      if (g) g.buchung_ids.push(f.id);
      else
        map.set(key, {
          schluessel: key,
          empfaenger: f.empfaenger ?? "",
          buchung_ids: [f.id],
        });
    }
    return Array.from(map.values())
      .filter((g) => g.buchung_ids.length >= 2)
      .sort((a, b) => b.buchung_ids.length - a.buchung_ids.length);
  }, [basis]);

  // Liste unten = Basis, zusätzlich auf den gewählten Empfänger gefiltert.
  const gefiltert = useMemo(() => {
    if (!empfaengerFilter) return basis;
    return basis.filter((f) => normEmpfaenger(f.empfaenger) === empfaengerFilter);
  }, [basis, empfaengerFilter]);

  const aktiveGruppe = empfaengerFilter
    ? gruppen.find((g) => g.schluessel === empfaengerFilter) ?? null
    : null;

  // Summe der ausgewählten Fälle – pro Währung getrennt, da gemischte
  // Währungen nicht aufaddiert werden dürfen.
  const auswahlSumme = useMemo(() => {
    const proWaehrung = new Map<string, number>();
    for (const f of faelle) {
      if (!auswahl.has(f.id)) continue;
      proWaehrung.set(f.waehrung, (proWaehrung.get(f.waehrung) ?? 0) + f.betrag);
    }
    return Array.from(proWaehrung.entries())
      .map(([waehrung, summe]) => ({ waehrung, summe }))
      .sort((a, b) => a.waehrung.localeCompare(b.waehrung));
  }, [faelle, auswahl]);

  async function reload(): Promise<Buchung[]> {
    setReloading(true);
    try {
      const res = await fetch("/api/pruefliste");
      const json = await res.json();
      if (res.ok) {
        const neu = (json.data ?? []) as Buchung[];
        setFaelle(neu);
        setAuswahl(new Set());
        setEmpfaengerFilter(null);
        router.refresh();
        return neu;
      }
    } catch {
      // Stillschweigend – nächste Aktion versucht erneut.
    } finally {
      setReloading(false);
    }
    return faelle;
  }

  function toggle(id: string) {
    setAuswahl((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function alleSichtbarenWaehlen(an: boolean) {
    setAuswahl(an ? new Set(gefiltert.map((f) => f.id)) : new Set());
  }

  function gruppeWaehlen(g: Mustergruppe) {
    if (empfaengerFilter === g.schluessel) {
      // Aktiven Filter wieder aufheben.
      setEmpfaengerFilter(null);
      setAuswahl(new Set());
      return;
    }
    // Liste auf diesen Empfänger filtern und alle Fälle direkt vorauswählen,
    // damit sowohl das Prüfen im Detail als auch die Bulk-Entscheidung möglich
    // bleiben.
    setEmpfaengerFilter(g.schluessel);
    setAuswahl(new Set(g.buchung_ids));
    toast.success(
      `Gefiltert auf „${g.empfaenger}" — ${g.buchung_ids.length} Fälle.`,
    );
  }

  function empfaengerFilterAufheben() {
    setEmpfaengerFilter(null);
    setAuswahl(new Set());
  }

  function oeffneEinzeln(f: Buchung) {
    setDialogFaelle([f]);
  }

  function oeffneBulk() {
    const sel = gefiltert.filter((f) => auswahl.has(f.id));
    if (sel.length === 0) {
      toast.error("Keine Fälle ausgewählt.");
      return;
    }
    setDialogFaelle(sel);
  }

  // PROJ-26 (Feature 1): Klassifikation eines Falls lokal (optimistisch) setzen,
  // als Vorbereitung fürs Akzeptieren per Tastatur. Persistiert wird erst beim
  // Akzeptieren/Entscheiden.
  function setzeKlassifikationLokal(id: string, klass: Klassifikation) {
    setFaelle((prev) =>
      prev.map((f) => (f.id === id ? { ...f, klassifikation: klass } : f)),
    );
  }

  // PROJ-26 (Feature 1 / AC2 / AC4): den fokussierten Fall mit seinem aktuell
  // vorgeschlagenen Wert auto-verbuchen. Nur erlaubt, wenn der Vorschlag
  // vollständig ist (Klassifikation gesetzt und – außer bei privat/neutral –
  // eine Kategorie). Sonst Hinweis + Dialog.
  async function akzeptiere(f: Buchung) {
    const klass = f.klassifikation;
    const vollstaendig =
      klass !== null &&
      klass !== "unklar" &&
      (klass === "privat" || klass === "neutral" || f.kategorie_id !== null);
    if (!vollstaendig) {
      toast.error("Vorschlag unvollständig – bitte im Dialog entscheiden.");
      oeffneEinzeln(f);
      return;
    }
    setAkzeptierePending(true);
    try {
      const res = await fetch("/api/pruefliste/entscheiden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buchung_ids: [f.id],
          kategorie_id: f.kategorie_id,
          ust_satz: f.ust_satz,
          klassifikation: klass,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Akzeptieren fehlgeschlagen.");
        return;
      }
      toast.success("Fall akzeptiert.");
      // Fall lokal entfernen, damit der Fokus (gleicher Index) auf den
      // nachrückenden nächsten Fall zeigt.
      setFaelle((prev) => prev.filter((b) => b.id !== f.id));
      setAuswahl((prev) => {
        if (!prev.has(f.id)) return prev;
        const next = new Set(prev);
        next.delete(f.id);
        return next;
      });
    } catch {
      toast.error("Netzwerkfehler beim Akzeptieren.");
    } finally {
      setAkzeptierePending(false);
    }
  }

  // PROJ-15 P2 (#1): die ausgewählten Fälle mit dem aktuellen Wissen
  // (Regeln, Empfänger-Cache, Historie) erneut klassifizieren. Manuell
  // bestätigte Buchungen werden serverseitig übersprungen.
  async function reklassifiziereAuswahl() {
    const ids = gefiltert.filter((f) => auswahl.has(f.id)).map((f) => f.id);
    const ok = await reklassifiziere(ids);
    if (ok) await reload();
  }

  async function nachEntscheidung(e: EntscheidungErgebnis) {
    setDialogFaelle(null);
    const neu = await reload();
    if (e.regel && e.gleichartige_offen > 0) {
      // Hinweis im State, plus konkretes Angebot.
      setNachregel({
        anzahl: e.gleichartige_offen,
        regelName: e.regel.bezeichnung,
      });
    }
    return neu;
  }

  async function gleichartigeReklassifizieren() {
    setNachregel(null);
    try {
      const res = await fetch("/api/klassifizierung?nur_offen=false", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nur_offen: false }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(
          json.error ??
            "Erneute Klassifizierung konnte nicht gestartet werden.",
        );
        return;
      }
      toast.success(
        "Re-Klassifizierung gestartet – die neue Regel greift jetzt auf offene Fälle.",
      );
      await reload();
    } catch {
      toast.error("Netzwerkfehler bei der Re-Klassifizierung.");
    }
  }

  const istLeer = faelle.length === 0;
  const alleGewaehlt =
    gefiltert.length > 0 && gefiltert.every((f) => auswahl.has(f.id));

  // PROJ-26 (Feature 1): Tastatur-Triage. Index-basiert auf die sichtbare,
  // gefilterte Liste. Listen-Shortcuts pausieren, während ein Dialog/Sheet/
  // Overlay offen ist (außer "?" und Esc, die der Hook gesondert behandelt).
  const { fokusIndex } = usePrueflisteTastatur({
    anzahl: gefiltert.length,
    // QA #1/#2 (PROJ-26): Listen-Shortcuts auch pausieren, wenn das Hilfe-
    // Overlay offen ist (sonst navigiert man die Liste darunter) und während
    // ein Akzeptieren-Request läuft (verhindert Doppel-Submit per Enter).
    blockiert:
      dialogFaelle !== null ||
      detailFall !== null ||
      nachregel !== null ||
      hilfeOffen ||
      akzeptierePending,
    onAkzeptieren: (i) => {
      const f = gefiltert[i];
      if (f) void akzeptiere(f);
    },
    onKlassifikation: (i, klass) => {
      const f = gefiltert[i];
      if (f) setzeKlassifikationLokal(f.id, klass);
    },
    onEntscheiden: (i) => {
      const f = gefiltert[i];
      if (f) oeffneEinzeln(f);
    },
    onHilfe: () => setHilfeOffen(true),
    onEscape: () => setHilfeOffen(false),
  });

  return (
    <div className="space-y-5">
      {/* Mustergruppen — iOS-Pill-Reihe */}
      {gruppen.length > 0 && (
        <section className="rounded-[var(--radius)] bg-card p-4 shadow-[var(--shadow-1)] ring-1 ring-line/60">
          <div className="mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-violet" />
            <div className="text-[13px] font-semibold">Mustergruppen</div>
            <div className="text-[12px] text-muted-foreground">
              Gleicher Empfänger — antippen, um die Liste zu filtern
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {gruppen.map((g) => {
              const aktiv = empfaengerFilter === g.schluessel;
              return (
                <button
                  key={g.schluessel}
                  type="button"
                  onClick={() => gruppeWaehlen(g)}
                  aria-pressed={aktiv}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors",
                    aktiv
                      ? "bg-brand-violet text-white"
                      : "bg-[color:var(--surface-2)] text-foreground hover:bg-tint-violet",
                  )}
                >
                  <span className="truncate max-w-[180px]">{g.empfaenger}</span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0 font-mono text-[10px] font-bold",
                      aktiv
                        ? "bg-white/25 text-white"
                        : "bg-brand-violet text-white",
                    )}
                  >
                    {g.buchung_ids.length}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Toolbar: Filter + Bulk-Aktion */}
      <section className="space-y-3 rounded-[var(--radius)] bg-card p-4 shadow-[var(--shadow-1)] ring-1 ring-line/60">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">
              {istLeer
                ? "Keine offenen Fälle"
                : `${gefiltert.length} von ${faelle.length} Fällen`}
            </div>
            <div className="text-[12px] text-muted-foreground">
              {istLeer
                ? "Alles erledigt — der Agent meldet sich, sobald wieder etwas Unsicheres reinkommt."
                : "Filtere und entscheide einzeln oder als Bulk."}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {empfaengerFilter && (
                <button
                  type="button"
                  onClick={empfaengerFilterAufheben}
                  className="inline-flex items-center gap-1 rounded-full bg-tint-violet px-2.5 py-1 text-[12px] font-medium text-brand-violet transition-colors hover:bg-brand-violet hover:text-white"
                >
                  Empfänger: {aktiveGruppe?.empfaenger ?? empfaengerFilter}
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              {(filterAktiv || empfaengerFilter) && (
                <button
                  type="button"
                  onClick={filterZuruecksetzen}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  <X className="h-3.5 w-3.5" />
                  Filter zurücksetzen
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Select value={konto} onValueChange={setKonto}>
              <SelectTrigger className="h-9 w-44 rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)] text-[13px]">
                <SelectValue placeholder="Konto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Konten</SelectItem>
                {konten.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.bezeichnung}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={grund} onValueChange={setGrund}>
              <SelectTrigger className="h-9 w-44 rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)] text-[13px]">
                <SelectValue placeholder="Grund" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle Gründe</SelectItem>
                {verfuegbareGruende.map((g) => (
                  <SelectItem key={g} value={g}>
                    {grundLabel(g)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortFeld)}>
              <SelectTrigger className="h-9 w-40 rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABEL) as SortFeld[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SORT_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={reklassifiziereAuswahl}
              disabled={auswahl.size === 0 || reklassPending}
              title="Ausgewählte Fälle mit dem aktuellen Wissen erneut klassifizieren (manuell bestätigte werden übersprungen)"
              className="h-9 rounded-full font-semibold"
            >
              {reklassPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-1.5 h-4 w-4" />
              )}
              Neu klassifizieren
            </Button>
            <Button
              onClick={oeffneBulk}
              disabled={auswahl.size === 0}
              className="h-9 rounded-full bg-brand-violet font-semibold text-white hover:bg-[color:var(--accent-hover)]"
            >
              {auswahl.size > 0
                ? `${auswahl.size} entscheiden`
                : "Auswahl entscheiden"}
            </Button>
          </div>
        </div>

        {/* Zweite Reihe: Suche + verfeinernde Filter */}
        {!istLeer && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line-hair pt-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={suche}
                onChange={(e) => setSuche(e.target.value)}
                placeholder="Empfänger oder Verwendungszweck suchen…"
                aria-label="Fälle durchsuchen"
                className="h-9 rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)] pl-9 text-[13px]"
              />
            </div>
            <Select
              value={klassFilter}
              onValueChange={(v) => setKlassFilter(v as KlassFilter)}
            >
              <SelectTrigger className="h-9 w-44 rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KLASS_FILTER_LABEL) as KlassFilter[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KLASS_FILTER_LABEL[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="w-56">
              <KategorieCombobox
                kategorien={kategorien}
                value={kategorieFilter}
                onChange={(v) => setKategorieFilter(v as KategorieFilter)}
                vorabOptionen={[
                  { value: "alle", label: "Alle Kategorien" },
                  { value: "ohne", label: "Ohne Kategorie" },
                ]}
                triggerClassName="h-9 bg-[color:var(--surface-2)] text-[13px]"
                placeholder="Kategorie-Status"
                ariaLabel="Nach Kategorie filtern"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Input
                value={betragVon}
                onChange={(e) => setBetragVon(e.target.value)}
                inputMode="decimal"
                placeholder="Betrag von"
                aria-label="Betrag von"
                className="h-9 w-28 rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)] text-[13px]"
              />
              <span className="text-[12px] text-muted-foreground">–</span>
              <Input
                value={betragBis}
                onChange={(e) => setBetragBis(e.target.value)}
                inputMode="decimal"
                placeholder="bis"
                aria-label="Betrag bis"
                className="h-9 w-24 rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)] text-[13px]"
              />
            </div>
          </div>
        )}
      </section>

      {/* Liste */}
      {istLeer ? (
        <section className="rounded-[var(--radius)] bg-card px-8 py-16 text-center shadow-[var(--shadow-1)] ring-1 ring-line/60">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-tint-cyan text-income-strong">
            ✓
          </div>
          <h2 className="mt-4 font-display text-xl font-bold tracking-[-0.012em]">
            Prüfliste ist leer
          </h2>
          <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-muted-foreground">
            Sobald der Agent unsichere Fälle findet, erscheinen sie hier.
          </p>
        </section>
      ) : gefiltert.length === 0 ? (
        <section className="rounded-[var(--radius)] bg-card px-6 py-12 text-center shadow-[var(--shadow-1)] ring-1 ring-line/60 text-[13px] text-muted-foreground">
          Kein Fall für die aktuelle Filterauswahl.
        </section>
      ) : (
        <section className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
          {/* Select-all-Bar */}
          <div className="flex items-center gap-3 border-b border-line-hair px-4 py-2.5">
            <Checkbox
              checked={alleGewaehlt}
              onCheckedChange={(v) => alleSichtbarenWaehlen(Boolean(v))}
              aria-label="Alle sichtbaren auswählen"
            />
            <span className="text-[12px] text-muted-foreground">
              {auswahl.size > 0
                ? `${auswahl.size} ausgewählt`
                : "Alle auswählen"}
            </span>
          </div>
          <ul role="list" className="divide-y divide-line-hair">
            {gefiltert.map((f, i) => (
              <PrueflisteZeile
                key={f.id}
                index={i}
                fall={f}
                kontoName={kontoName(f.konto_id)}
                ausgewaehlt={auswahl.has(f.id)}
                fokussiert={i === fokusIndex}
                onToggle={() => toggle(f.id)}
                onEntscheiden={() => oeffneEinzeln(f)}
                onInfo={() => setDetailFall(f)}
                gemerkt={merk.istGemerkt(f.id)}
                merkenPending={merk.istPending(f.id)}
                onToggleMerken={() => merk.toggle(f.id)}
              />
            ))}
          </ul>
          {/* Summenzeile der ausgewählten Fälle */}
          {auswahl.size > 0 && (
            <div className="flex items-center justify-between gap-3 border-t border-line-hair bg-[color:var(--surface-2)] px-4 py-3">
              <span className="text-[12px] font-medium text-muted-foreground">
                Summe · {auswahl.size} ausgewählt
              </span>
              <div className="flex flex-col items-end gap-0.5">
                {auswahlSumme.map(({ waehrung, summe }) => (
                  <div
                    key={waehrung}
                    className="font-mono text-[15px] font-bold tabular-nums leading-tight"
                  >
                    <span
                      className={cn(
                        summe < 0 ? "text-destructive" : "text-income-strong",
                      )}
                    >
                      {summe < 0 ? "−" : "+"}
                      {formatBetrag(Math.abs(summe))}
                    </span>
                    <span className="ml-1.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {waehrung}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* PROJ-26 (AC8): dezenter Tastatur-Hinweis-Footer */}
      {!istLeer && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Keyboard className="h-3.5 w-3.5" />
            Tastatur:{" "}
            <kbd className="rounded bg-[color:var(--surface-2)] px-1 font-mono text-[11px] ring-1 ring-line/60">
              j
            </kbd>
            /
            <kbd className="rounded bg-[color:var(--surface-2)] px-1 font-mono text-[11px] ring-1 ring-line/60">
              k
            </kbd>{" "}
            bewegen ·{" "}
            <kbd className="rounded bg-[color:var(--surface-2)] px-1 font-mono text-[11px] ring-1 ring-line/60">
              Enter
            </kbd>{" "}
            akzeptiert ·{" "}
            <kbd className="rounded bg-[color:var(--surface-2)] px-1 font-mono text-[11px] ring-1 ring-line/60">
              ?
            </kbd>{" "}
            zeigt alle Shortcuts
          </span>
          <button
            type="button"
            onClick={() => setHilfeOffen(true)}
            className="inline-flex items-center gap-1 font-medium underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            Shortcuts
          </button>
        </div>
      )}

      {(reloading || akzeptierePending) && (
        <div className="flex items-center gap-2 px-2 text-[12px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Aktualisiere…
        </div>
      )}

      {dialogFaelle && (
        <EntscheidungsDialog
          open={dialogFaelle !== null}
          onOpenChange={(o) => {
            if (!o) setDialogFaelle(null);
          }}
          faelle={dialogFaelle}
          kategorien={kategorien}
          onEntschieden={nachEntscheidung}
        />
      )}

      <BuchungDetailSheet
        buchung={detailFall}
        kategorien={kategorien}
        open={detailFall !== null}
        onOpenChange={(o) => {
          if (!o) setDetailFall(null);
        }}
        gemerkt={detailFall ? merk.istGemerkt(detailFall.id) : false}
        merkenPending={detailFall ? merk.istPending(detailFall.id) : false}
        onToggleMerken={
          detailFall ? () => merk.toggle(detailFall.id) : undefined
        }
      />

      <AlertDialog
        open={nachregel !== null}
        onOpenChange={(o) => {
          if (!o) setNachregel(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gleichartige Fälle mitnehmen?</AlertDialogTitle>
            <AlertDialogDescription>
              Die Regel „{nachregel?.regelName}" passt zu ca.{" "}
              {nachregel?.anzahl} weiteren offenen Prüffällen. Sollen diese
              jetzt mit der neuen Regel erneut klassifiziert werden? Bereits
              bestätigte Buchungen bleiben unverändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Später</AlertDialogCancel>
            <AlertDialogAction onClick={gleichartigeReklassifizieren}>
              Jetzt anwenden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PROJ-26 (AC3): Shortcut-Hilfe-Overlay */}
      <Dialog open={hilfeOffen} onOpenChange={setHilfeOffen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-brand-violet" />
              Tastatur-Shortcuts
            </DialogTitle>
            <DialogDescription>
              Arbeite die Prüfliste rein per Tastatur durch.
            </DialogDescription>
          </DialogHeader>
          <dl className="divide-y divide-line-hair">
            {SHORTCUTS.map(({ tasten, aktion }) => (
              <div
                key={aktion}
                className="flex items-center justify-between gap-4 py-2"
              >
                <dt className="flex items-center gap-1">
                  {tasten.map((t) => (
                    <kbd
                      key={t}
                      className="rounded bg-[color:var(--surface-2)] px-1.5 py-0.5 font-mono text-[12px] font-semibold ring-1 ring-line/60"
                    >
                      {t}
                    </kbd>
                  ))}
                </dt>
                <dd className="text-[13px] text-muted-foreground">{aktion}</dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// PROJ-26: Shortcut-Übersicht fürs Hilfe-Overlay.
const SHORTCUTS: Array<{ tasten: string[]; aktion: string }> = [
  { tasten: ["j", "↓"], aktion: "Nächster Fall" },
  { tasten: ["k", "↑"], aktion: "Voriger Fall" },
  { tasten: ["Enter", "a"], aktion: "Vorschlag akzeptieren" },
  { tasten: ["g"], aktion: "Als geschäftlich setzen" },
  { tasten: ["p"], aktion: "Als privat setzen" },
  { tasten: ["n"], aktion: "Als neutral setzen" },
  { tasten: ["e"], aktion: "Entscheidungs-Dialog öffnen" },
  { tasten: ["?"], aktion: "Diese Hilfe anzeigen" },
  { tasten: ["Esc"], aktion: "Hilfe schließen / Fokus aufheben" },
];

// ---------------------------------------------------------------------------
// PrueflisteZeile — iOS-Listen-Eintrag pro Fall
// ---------------------------------------------------------------------------

function PrueflisteZeile({
  fall: f,
  index,
  kontoName,
  ausgewaehlt,
  fokussiert,
  onToggle,
  onEntscheiden,
  onInfo,
  gemerkt,
  merkenPending,
  onToggleMerken,
}: {
  fall: Buchung;
  index: number;
  kontoName: string;
  ausgewaehlt: boolean;
  fokussiert: boolean;
  onToggle: () => void;
  onEntscheiden: () => void;
  onInfo: () => void;
  gemerkt: boolean;
  merkenPending: boolean;
  onToggleMerken: () => void;
}) {
  const ausgabe = f.betrag < 0;
  const gruende = gruendeListe(f.pruef_grund);
  // PROJ-26 (Feature 3): leichter Inline-Toggle für die Begründung — getrennt
  // vom großen Detail-Sheet (onInfo), kein zusätzlicher Datenfetch.
  const [warumOffen, setWarumOffen] = useState(false);
  return (
    <li
      data-fokus-index={index}
      aria-current={fokussiert ? "true" : undefined}
      className={cn(
        "group relative transition-colors",
        fokussiert && "bg-tint-violet ring-2 ring-inset ring-brand-violet",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 transition-colors",
          !fokussiert &&
            (ausgewaehlt
              ? "bg-tint-violet/40"
              : "hover:bg-[color:var(--surface-2)]"),
        )}
      >
        <Checkbox
          checked={ausgewaehlt}
          onCheckedChange={onToggle}
          aria-label={`Fall ${f.empfaenger ?? f.id} auswählen`}
        />
        {/* Vorzeichen-Icon */}
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]",
            ausgabe
              ? "bg-tint-cerise text-destructive"
              : "bg-tint-cyan text-income-strong",
          )}
          aria-hidden
        >
          {ausgabe ? (
            <ArrowDownLeft className="h-4 w-4" />
          ) : (
            <ArrowUpRight className="h-4 w-4" />
          )}
        </div>
        {/* Empfänger + Zweck */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-semibold leading-tight">
              {f.empfaenger ?? "—"}
            </span>
            {gruende.map((g) => (
              <span
                key={g}
                className="inline-flex items-center rounded-full bg-tint-cerise px-2 py-0 text-[10px] font-semibold text-destructive"
              >
                {grundLabel(g)}
              </span>
            ))}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <span>{formatDatum(f.buchung_datum)}</span>
            <span className="text-line-strong">·</span>
            <span className="truncate">{f.verwendungszweck ?? kontoName}</span>
          </div>
        </div>
        {/* Betrag */}
        <div className="shrink-0 text-right">
          <div
            className={cn(
              "font-mono text-[15px] font-bold tabular-nums leading-tight",
              ausgabe ? "text-destructive" : "text-income-strong",
            )}
          >
            {ausgabe ? "−" : "+"}
            {formatBetrag(Math.abs(f.betrag))}
          </div>
          <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {f.waehrung} · {kontoName}
          </div>
        </div>
        {/* Warum? — Inline-Begründung aufklappen */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setWarumOffen((v) => !v)}
          aria-expanded={warumOffen}
          title="Begründung anzeigen"
          className="h-8 shrink-0 gap-1 rounded-full px-2 text-[12px] font-medium text-muted-foreground hover:bg-tint-violet hover:text-brand-violet"
        >
          Warum?
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              warumOffen && "rotate-180",
            )}
          />
        </Button>
        {/* Detail-Info */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onInfo}
          aria-label="Buchungsdetails anzeigen"
          title="Buchungsdetails anzeigen"
          className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-tint-violet hover:text-brand-violet"
        >
          <Info className="h-4 w-4" />
        </Button>
        {/* Merken */}
        <MerkenStern
          gemerkt={gemerkt}
          pending={merkenPending}
          onToggle={onToggleMerken}
          size="sm"
        />
        {/* Aktion */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onEntscheiden}
          className="h-8 shrink-0 rounded-full text-[12.5px] font-semibold text-brand-violet hover:bg-tint-violet hover:text-brand-violet"
        >
          Entscheiden
          <ChevronRight className="ml-0.5 h-3.5 w-3.5" />
        </Button>
      </div>
      {warumOffen && <PrueflisteBegruendung fall={f} />}
    </li>
  );
}
