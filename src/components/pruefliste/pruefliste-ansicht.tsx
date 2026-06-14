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
  ChevronRight,
  Info,
  Layers,
  Loader2,
  X,
} from "lucide-react";
import type { Buchung, Kategorie, Konto } from "@/lib/types";
import { BuchungDetailSheet } from "@/components/buchungen/buchung-detail-sheet";
import { MerkenStern } from "@/components/merkliste/merken-stern";
import { useMerkSet } from "@/hooks/use-merk-set";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  EntscheidungsDialog,
  type EntscheidungErgebnis,
} from "./entscheidungs-dialog";
import { formatBetrag, formatDatum, gruendeListe, grundLabel } from "./labels";

interface Mustergruppe {
  schluessel: string;
  empfaenger: string;
  buchung_ids: string[];
}

function normEmpfaenger(value: string | null): string {
  return (value ?? "").toLowerCase().trim();
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
  const [faelle, setFaelle] = useState<Buchung[]>(initialFaelle);
  // PROJ-20: Merken unabhängig vom Entscheiden — eine Buchung kann in der
  // Prüfliste bleiben und trotzdem gemerkt sein.
  const merk = useMerkSet(
    initialFaelle.filter((f) => f.gemerkt_am !== null).map((f) => f.id),
  );
  const [konto, setKonto] = useState("alle");
  const [grund, setGrund] = useState("alle");
  const [sort, setSort] = useState<"datum" | "betrag">("datum");
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

  const kontoName = (id: string) =>
    konten.find((k) => k.id === id)?.bezeichnung ?? "—";

  const verfuegbareGruende = useMemo(() => {
    const s = new Set<string>();
    for (const f of faelle) {
      for (const g of gruendeListe(f.pruef_grund)) s.add(g);
    }
    return Array.from(s).sort();
  }, [faelle]);

  // Basis = Konto-/Grund-Filter + Sortierung. Die Mustergruppen werden hieraus
  // gebildet, damit alle Empfänger-Chips sichtbar bleiben, auch wenn unten
  // bereits auf einen Empfänger gefiltert ist.
  const basis = useMemo(() => {
    let liste = faelle.slice();
    if (konto !== "alle") liste = liste.filter((f) => f.konto_id === konto);
    if (grund !== "alle") {
      liste = liste.filter((f) => gruendeListe(f.pruef_grund).includes(grund));
    }
    liste.sort((a, b) =>
      sort === "betrag"
        ? Math.abs(b.betrag) - Math.abs(a.betrag)
        : b.buchung_datum.localeCompare(a.buchung_datum),
    );
    return liste;
  }, [faelle, konto, grund, sort]);

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
            {empfaengerFilter && (
              <button
                type="button"
                onClick={empfaengerFilterAufheben}
                className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-tint-violet px-2.5 py-1 text-[12px] font-medium text-brand-violet transition-colors hover:bg-brand-violet hover:text-white"
              >
                Empfänger: {aktiveGruppe?.empfaenger ?? empfaengerFilter}
                <X className="h-3.5 w-3.5" />
              </button>
            )}
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
            <Select
              value={sort}
              onValueChange={(v) => setSort(v as "datum" | "betrag")}
            >
              <SelectTrigger className="h-9 w-36 rounded-[var(--radius-inner)] border-line bg-[color:var(--surface-2)] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="datum">Nach Datum</SelectItem>
                <SelectItem value="betrag">Nach Betrag</SelectItem>
              </SelectContent>
            </Select>
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
            {gefiltert.map((f) => (
              <PrueflisteZeile
                key={f.id}
                fall={f}
                kontoName={kontoName(f.konto_id)}
                ausgewaehlt={auswahl.has(f.id)}
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

      {reloading && (
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// PrueflisteZeile — iOS-Listen-Eintrag pro Fall
// ---------------------------------------------------------------------------

function PrueflisteZeile({
  fall: f,
  kontoName,
  ausgewaehlt,
  onToggle,
  onEntscheiden,
  onInfo,
  gemerkt,
  merkenPending,
  onToggleMerken,
}: {
  fall: Buchung;
  kontoName: string;
  ausgewaehlt: boolean;
  onToggle: () => void;
  onEntscheiden: () => void;
  onInfo: () => void;
  gemerkt: boolean;
  merkenPending: boolean;
  onToggleMerken: () => void;
}) {
  const ausgabe = f.betrag < 0;
  const gruende = gruendeListe(f.pruef_grund);
  return (
    <li
      className={cn(
        "group relative flex items-center gap-3 px-4 py-3 transition-colors",
        ausgewaehlt ? "bg-tint-violet/40" : "hover:bg-[color:var(--surface-2)]",
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
    </li>
  );
}
