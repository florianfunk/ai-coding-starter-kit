"use client";

// Client-Komponente fuer die Kuendigungs-Liste.
//   - Laedt /api/kuendigungen
//   - Zeigt pro Empfaenger: Anzeige-Name, Intervall, Pro Zahlung,
//     Jahresvolumen, Status, Notiz.
//   - Status-Wechsel (offen → gekuendigt → beendet) per Dropdown.
//   - Notiz-Editor inline.
//   - "Markierung entfernen" pro Zeile.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Ban, Loader2, Trash2 } from "lucide-react";

import type {
  KuendigungenListeResponse,
  KuendigungStatus,
  KuendigungZeile,
} from "@/app/api/kuendigungen/route";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function eur(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}
function deDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function intervallLabel(tage: number | null): string {
  if (tage == null) return "—";
  if (tage <= 10) return `wöchentlich (~${tage} T)`;
  if (tage <= 40) return `monatlich (~${tage} T)`;
  if (tage <= 110) return `quartalsweise (~${tage} T)`;
  return `jährlich (~${tage} T)`;
}

const STATUS_LABEL: Record<KuendigungStatus, string> = {
  offen: "offen",
  gekuendigt: "gekündigt",
  beendet: "beendet",
};

export function KuendigungenListe() {
  const [zeilen, setZeilen] = useState<KuendigungZeile[]>([]);
  const [laden, setLaden] = useState(true);
  const [aktiveAktion, setAktiveAktion] = useState<string | null>(null);

  const laden_daten = useCallback(async () => {
    setLaden(true);
    try {
      const r = await fetch("/api/kuendigungen");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as KuendigungenListeResponse;
      setZeilen(j.data);
    } catch (e) {
      toast.error(
        "Liste konnte nicht geladen werden: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => {
    void laden_daten();
  }, [laden_daten]);

  async function aenderStatus(z: KuendigungZeile, status: KuendigungStatus) {
    if (status === z.status) return;
    setAktiveAktion(z.empfaenger_norm);
    try {
      const r = await fetch(
        `/api/kuendigungen/${encodeURIComponent(z.empfaenger_norm)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      setZeilen((bs) =>
        bs.map((b) => (b.empfaenger_norm === z.empfaenger_norm ? { ...b, status } : b)),
      );
      toast.success(`Status auf "${STATUS_LABEL[status]}" gesetzt`);
    } catch (e) {
      toast.error(
        "Status-Wechsel fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setAktiveAktion(null);
    }
  }

  async function entferneMarkierung(z: KuendigungZeile) {
    if (!confirm(`Markierung fuer "${z.empfaenger_anzeige}" entfernen?`)) return;
    setAktiveAktion(z.empfaenger_norm);
    try {
      const r = await fetch(
        `/api/kuendigungen/${encodeURIComponent(z.empfaenger_norm)}`,
        { method: "DELETE" },
      );
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      setZeilen((bs) => bs.filter((b) => b.empfaenger_norm !== z.empfaenger_norm));
      toast.success("Markierung entfernt");
    } catch (e) {
      toast.error(
        "Loeschen fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setAktiveAktion(null);
    }
  }

  if (laden) {
    return (
      <div className="rounded-[var(--radius)] bg-card px-5 py-8 shadow-[var(--shadow-1)] ring-1 ring-line/60">
        <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Liste wird geladen…
        </div>
      </div>
    );
  }

  if (zeilen.length === 0) {
    return (
      <div className="rounded-[var(--radius)] bg-card px-8 py-16 text-center shadow-[var(--shadow-1)] ring-1 ring-line/60">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-tint-violet text-brand-violet">
          <Ban className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold tracking-[-0.012em]">
          Noch nichts zur Kündigung markiert
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-[13.5px] text-muted-foreground">
          Im Abo-Radar (Kategorien-Analyse) eine wiederkehrende Buchung
          ausklappen und auf <em>„Zur Kündigung markieren"</em> klicken.
        </p>
      </div>
    );
  }

  // Summe der aktiven (offen + gekuendigt) Jahresvolumina als Hinweis.
  const summeNochLaufend = zeilen
    .filter((z) => z.status !== "beendet")
    .reduce((s, z) => s + z.statistik.jahresbelastung, 0);

  return (
    <div className="space-y-4">
      {/* KPI-Streifen */}
      <section className="rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
        <div className="grid grid-cols-2 divide-x divide-line-hair">
          <div className="px-5 py-4">
            <div className="text-[12px] font-medium text-muted-foreground">
              Markiert insgesamt
            </div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums">
              {zeilen.length}
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[12px] font-medium text-muted-foreground">
              Jahresvolumen offen
            </div>
            <div className="mt-1 font-mono text-xl font-bold tabular-nums text-destructive">
              {eur(summeNochLaufend)}
            </div>
          </div>
        </div>
      </section>

      {/* Liste */}
      <section className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
        <ul role="list" className="divide-y divide-line-hair">
          {zeilen.map((z) => {
            const busy = aktiveAktion === z.empfaenger_norm;
            return (
              <li
                key={z.empfaenger_norm}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* Empfänger */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="truncate text-[14px] font-semibold leading-tight"
                      title={z.empfaenger_anzeige}
                    >
                      {z.empfaenger_anzeige}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-[color:var(--surface-2)] px-2 py-0 text-[10px] font-medium text-muted-foreground">
                      {intervallLabel(z.statistik.intervall_tage)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                    <span>{z.statistik.anzahl}× erfasst</span>
                    <span className="text-line-strong">·</span>
                    <span>letzte {deDate(z.statistik.letzte)}</span>
                    <span className="text-line-strong">·</span>
                    <span>markiert {deDate(z.markiert_am.slice(0, 10))}</span>
                  </div>
                </div>
                {/* Zahlen */}
                <div className="hidden shrink-0 items-baseline gap-5 text-right sm:flex">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      Pro Zahlung
                    </div>
                    <div className="font-mono text-[13px] font-semibold tabular-nums">
                      {eur(z.statistik.durchschnitt)}
                    </div>
                  </div>
                  <div className="min-w-[100px]">
                    <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      Jahr
                    </div>
                    <div className="font-mono text-[15px] font-bold tabular-nums text-destructive">
                      {eur(z.statistik.jahresbelastung)}
                    </div>
                  </div>
                </div>
                {/* Status-Select als Pill */}
                <Select
                  value={z.status}
                  onValueChange={(v) =>
                    aenderStatus(z, v as KuendigungStatus)
                  }
                  disabled={busy}
                >
                  <SelectTrigger className="h-8 w-[140px] rounded-full border-0 bg-[color:var(--surface-2)] px-3 text-[12px]">
                    <SelectValue>
                      <span
                        className={
                          "rounded-full px-2 py-0 text-[11px] font-semibold " +
                          (z.status === "offen"
                            ? "bg-tint-cerise text-destructive"
                            : z.status === "gekuendigt"
                              ? "bg-tint-yellow text-highlight-strong"
                              : "bg-tint-cyan text-income-strong")
                        }
                      >
                        {STATUS_LABEL[z.status]}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offen">offen</SelectItem>
                    <SelectItem value="gekuendigt">gekündigt</SelectItem>
                    <SelectItem value="beendet">beendet</SelectItem>
                  </SelectContent>
                </Select>
                {/* Löschen */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-tint-cerise hover:text-destructive"
                  disabled={busy}
                  onClick={() => entferneMarkierung(z)}
                  title="Markierung entfernen"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
