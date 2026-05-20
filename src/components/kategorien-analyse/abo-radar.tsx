"use client";

// PROJ-14 — Abo-/Wiederkehr-Radar mit Drill-Down:
//   - Tabelle pro erkanntem Wiederkehr-Item (Empfänger, Intervall, Anzahl,
//     Ø Betrag, Jahresbelastung, letzte Zahlung, Status, Konfidenz)
//   - Klick / Pfeil-Icon klappt die Buchungen des Items aus
//   - In der Aufklappung: jede Buchung mit Datum/Betrag/Konto + Inline-
//     Kategorie-Select pro Buchung
//   - "Kategorie auf alle anwenden" — Bulk-Aktion über
//     /api/buchungen/bulk-kategorie
//   - Optional: Detail-Sheet pro Buchung (BuchungDetailSheet)

import {
  Fragment,
  useEffect,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import {
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Eye,
  Loader2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type {
  WiederkehrendItem,
  WiederkehrendBuchung,
  WiederkehrendResponse,
} from "@/app/api/finanzen/wiederkehrend/route";
import type { BulkKategorieResponse } from "@/app/api/buchungen/bulk-kategorie/route";
import type { KategorieTyp } from "@/lib/types";
import { BuchungDetailSheet } from "@/components/kategorien-analyse/buchung-detail-sheet";

interface KategorieOption {
  id: string;
  bezeichnung: string;
  typ: KategorieTyp;
  aktiv: boolean;
}

const INTERVALL_LABEL: Record<WiederkehrendItem["intervall"], string> = {
  woechentlich: "wöchentlich",
  monatlich: "monatlich",
  quartalsweise: "quartalsweise",
  jaehrlich: "jährlich",
};

const TYP_BADGE: Record<string, "default" | "secondary" | "outline"> = {
  einnahme: "default",
  ausgabe: "secondary",
  privat: "outline",
  neutral: "outline",
};
const TYP_LABEL: Record<string, string> = {
  einnahme: "Einnahme",
  ausgabe: "Ausgabe",
  privat: "Privat",
  neutral: "Neutral",
};

const RICHTUNG_LABEL: Record<WiederkehrendItem["richtung"], string> = {
  einnahme: "Einnahme",
  ausgabe: "Ausgabe",
};

function eur(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}
function deDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function AboRadar({
  abos,
  onMutiert,
}: {
  abos: WiederkehrendResponse;
  /** Wird gerufen, sobald sich Buchungen geändert haben (Cockpit lädt neu). */
  onMutiert?: () => void;
}) {
  const [kategorien, setKategorien] = useState<KategorieOption[]>([]);
  const [aufgeklappt, setAufgeklappt] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);

  // Kategorien einmalig für die Selects laden
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/kontenrahmen");
        if (r.ok) {
          const j = (await r.json()) as { data: KategorieOption[] };
          setKategorien(j.data.filter((k) => k.aktiv));
        }
      } catch {
        /* nicht hard-failen — Inline-Edit nur eingeschränkt */
      }
    })();
  }, []);

  const aktiv = abos.items.filter((i) => i.noch_aktiv);
  const inaktiv = abos.items.filter((i) => !i.noch_aktiv);

  function itemKey(i: WiederkehrendItem): string {
    return `${i.empfaenger}__${i.intervall}`;
  }

  function toggle(i: WiederkehrendItem) {
    const k = itemKey(i);
    setAufgeklappt((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  const alleAufgeklappt =
    abos.items.length > 0 && aufgeklappt.size === abos.items.length;

  function toggleAlle() {
    if (alleAufgeklappt) {
      setAufgeklappt(new Set());
    } else {
      setAufgeklappt(new Set(abos.items.map(itemKey)));
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-base">
            Abo-/Wiederkehr-Radar
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Lookback {abos.lookback.von} – {abos.lookback.bis}
            </span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Wiederkehrende Buchungen (Einnahmen &amp; Ausgaben)
          </p>
        </div>
        {abos.items.length > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleAlle}
            className="h-8 shrink-0 gap-1.5 text-xs"
            title={
              alleAufgeklappt
                ? "Alle Buchungslisten zuklappen"
                : "Alle Buchungslisten aufklappen"
            }
          >
            {alleAufgeklappt ? (
              <ChevronsDownUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5" />
            )}
            {alleAufgeklappt ? "Alle zuklappen" : "Alle aufklappen"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {abos.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine wiederkehrenden Zahlungen erkannt. Erkannt werden
            Zahlungen mit ≥ 3 Buchungen, stabilem Betrag (±30 %) und
            regelmäßigem Abstand. Einzelne Ausreißer werden toleriert.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground">
                  Aktive Ausgaben / Jahr:
                </span>{" "}
                <span className="font-semibold text-destructive tabular-nums">
                  {eur(abos.jahresbelastung_ausgaben_aktiv)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Aktive Einnahmen / Jahr:
                </span>{" "}
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {eur(abos.jahresbelastung_einnahmen_aktiv)}
                </span>
              </div>
              <div className="sm:col-span-2 text-xs text-muted-foreground">
                {aktiv.length} aktiv · {inaktiv.length} inaktiv/gekündigt
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[28px]"></TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Richtung</TableHead>
                  <TableHead>Intervall</TableHead>
                  <TableHead className="text-right">Anzahl</TableHead>
                  <TableHead className="text-right">Pro Zahlung</TableHead>
                  <TableHead className="text-right">Jahresvolumen</TableHead>
                  <TableHead>Letzte</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Konf.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {abos.items.map((i) => {
                  const k = itemKey(i);
                  const expanded = aufgeklappt.has(k);
                  return (
                    <Fragment key={k}>
                      <TableRow
                        className={
                          "cursor-pointer hover:bg-muted/40 " +
                          (!i.noch_aktiv ? "opacity-60" : "")
                        }
                        onClick={() => toggle(i)}
                      >
                        <TableCell className="p-0 pl-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(i);
                            }}
                            aria-label={
                              expanded ? "Zuklappen" : "Buchungen anzeigen"
                            }
                            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted"
                          >
                            {expanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate font-medium">
                          {i.empfaenger}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              i.richtung === "einnahme" ? "default" : "secondary"
                            }
                            className={
                              "text-xs " +
                              (i.richtung === "einnahme"
                                ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                                : "")
                            }
                          >
                            {RICHTUNG_LABEL[i.richtung]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {INTERVALL_LABEL[i.intervall]} (~{i.intervall_tage} T)
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {i.anzahl}×
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {eur(i.durchschnitt)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-mono">
                          {eur(i.jahresbelastung)}
                        </TableCell>
                        <TableCell className="tabular-nums text-xs text-muted-foreground">
                          {deDate(i.letzte)}
                        </TableCell>
                        <TableCell>
                          {i.noch_aktiv ? (
                            <Badge variant="default" className="text-xs">
                              aktiv
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              gekündigt?
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {Math.round(i.konfidenz * 100)} %
                        </TableCell>
                      </TableRow>
                      {expanded ? (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell />
                          <TableCell colSpan={9} className="py-3">
                            <ItemDrilldown
                              item={i}
                              kategorien={kategorien}
                              onOpenSheet={(id) => setDetailId(id)}
                              onMutiert={onMutiert}
                              onZuklappen={() => {
                                setAufgeklappt((s) => {
                                  const n = new Set(s);
                                  n.delete(k);
                                  return n;
                                });
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <BuchungDetailSheet
        buchungId={detailId}
        kategorien={kategorien}
        onClose={() => setDetailId(null)}
        onMutiert={() => onMutiert?.()}
      />
    </Card>
  );
}

function ItemDrilldown({
  item,
  kategorien,
  onOpenSheet,
  onMutiert,
  onZuklappen,
}: {
  item: WiederkehrendItem;
  kategorien: KategorieOption[];
  onOpenSheet: (id: string) => void;
  onMutiert?: () => void;
  /** Wird nach "Alle bestätigen & Regel lernen" aufgerufen, um die Gruppe automatisch zu schließen. */
  onZuklappen?: () => void;
}) {
  // Lokaler Snapshot der Buchungen, damit Inline-Edit + Bulk optimistisch
  // sichtbar werden, ohne dass der ganze Radar neu lädt.
  const [buchungen, setBuchungen] = useState<WiederkehrendBuchung[]>(
    item.buchungen,
  );
  useEffect(() => setBuchungen(item.buchungen), [item.buchungen]);

  const [bulkKat, setBulkKat] = useState<string>("__none__");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bestaetigeId, setBestaetigeId] = useState<string | null>(null);
  const [bulkBusy, startBulk] = useTransition();

  const distinct = new Set(buchungen.map((b) => b.kategorie_id ?? "__none__"));
  const alleGleicheKategorie = distinct.size === 1;
  const aktuelleKategorieId =
    alleGleicheKategorie && !distinct.has("__none__")
      ? Array.from(distinct)[0]
      : null;

  async function aendereEinzeln(b: WiederkehrendBuchung, neueId: string) {
    if (neueId === b.kategorie_id) return;
    setSavingId(b.id);
    try {
      const r = await fetch(`/api/buchungen/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kategorie_id: neueId, bestaetigen: true }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      const neueKat = kategorien.find((k) => k.id === neueId);
      setBuchungen((bs) =>
        bs.map((x) =>
          x.id === b.id
            ? {
                ...x,
                kategorie_id: neueId,
                kategorie_bezeichnung: neueKat?.bezeichnung ?? null,
                kategorie_typ: neueKat?.typ ?? null,
                status: "manuell_bestaetigt",
              }
            : x,
        ),
      );
      toast.success("Kategorie geändert");
      onMutiert?.();
    } catch (e) {
      toast.error("Fehler: " + (e instanceof Error ? e.message : "unbekannt"));
    } finally {
      setSavingId(null);
    }
  }

  /**
   * Legt eine Lernregel für `item.empfaenger → kategorie_id` an. Idempotent:
   * existiert bereits eine aktive Regel mit demselben Muster + derselben
   * Kategorie, wird sie nicht erneut angelegt. Liefert ein Status-Flag, damit
   * der Aufrufer den passenden Toast zeigen kann.
   */
  async function lerneRegelFuer(
    kategorieId: string,
    kategorieTyp: KategorieTyp | null,
  ): Promise<"angelegt" | "vorhanden" | "fehler" | "uebersprungen"> {
    const muster = item.empfaenger.trim();
    if (muster.length < 2) return "uebersprungen";

    const klassifikation: "privat" | "geschaeftlich" | "neutral" =
      kategorieTyp === "privat"
        ? "privat"
        : kategorieTyp === "neutral"
          ? "neutral"
          : "geschaeftlich";

    const rg = await fetch("/api/regeln");
    if (rg.ok) {
      const jr = (await rg.json()) as {
        data: Array<{
          bedingung: { empfaenger_muster?: string | null } | null;
          aktion: { kategorie_id?: string | null } | null;
          aktiv: boolean;
        }>;
      };
      const norm = muster.toLowerCase();
      const bestehtSchon = (jr.data ?? []).some(
        (re) =>
          re.aktiv &&
          (re.bedingung?.empfaenger_muster ?? "").toLowerCase().trim() ===
            norm &&
          re.aktion?.kategorie_id === kategorieId,
      );
      if (bestehtSchon) return "vorhanden";
    }

    const reg = await fetch("/api/regeln", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bezeichnung: `Empfänger: ${muster}`.slice(0, 120),
        bedingung: { empfaenger_muster: muster },
        aktion: { kategorie_id: kategorieId, klassifikation },
        prioritaet: 100,
        aktiv: true,
      }),
    });
    if (reg.ok) return "angelegt";
    const e = (await reg.json().catch(() => null)) as { error?: string } | null;
    toast.warning(
      "Regel konnte nicht angelegt werden: " +
        (e?.error ?? `HTTP ${reg.status}`),
    );
    return "fehler";
  }

  function regelToast(
    status: "angelegt" | "vorhanden" | "fehler" | "uebersprungen",
    fallback: string,
  ) {
    if (status === "angelegt") {
      toast.success(`${fallback} — Regel für "${item.empfaenger}" gelernt`);
    } else if (status === "vorhanden") {
      toast.success(`${fallback} — passende Regel ist bereits aktiv`);
    } else {
      toast.success(fallback);
    }
  }

  async function bestaetigeUndLerne(b: WiederkehrendBuchung) {
    if (!b.kategorie_id) {
      toast.error("Bitte zuerst eine Kategorie wählen.");
      return;
    }
    setBestaetigeId(b.id);
    try {
      const r = await fetch(`/api/buchungen/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bestaetigen: true }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }

      const regelStatus = await lerneRegelFuer(b.kategorie_id, b.kategorie_typ);

      setBuchungen((bs) =>
        bs.map((x) =>
          x.id === b.id ? { ...x, status: "manuell_bestaetigt" } : x,
        ),
      );
      regelToast(regelStatus, "Buchung bestätigt");
      onMutiert?.();
    } catch (e) {
      toast.error(
        "Bestätigen fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setBestaetigeId(null);
    }
  }

  /**
   * Pro Zeile: Kategorie dieser Buchung auf ALLE Buchungen des Items
   * anwenden + alle als manuell bestätigt markieren + Lernregel anlegen.
   */
  async function uebernehmeKategorieUndBestaetige(b: WiederkehrendBuchung) {
    if (!b.kategorie_id) {
      toast.error("Diese Buchung hat noch keine Kategorie.");
      return;
    }
    setBestaetigeId(b.id);
    try {
      const ids = buchungen.map((x) => x.id);
      const r = await fetch("/api/buchungen/bulk-kategorie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, kategorie_id: b.kategorie_id }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as BulkKategorieResponse;
      setBuchungen((bs) =>
        bs.map((x) => ({
          ...x,
          kategorie_id: j.kategorie.id,
          kategorie_bezeichnung: j.kategorie.bezeichnung,
          kategorie_typ: j.kategorie.typ,
          status: "manuell_bestaetigt",
        })),
      );

      const regelStatus = await lerneRegelFuer(j.kategorie.id, j.kategorie.typ);
      regelToast(
        regelStatus,
        `${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} auf "${j.kategorie.bezeichnung}" gesetzt`,
      );
      onMutiert?.();
    } catch (e) {
      toast.error(
        "Übernehmen fehlgeschlagen: " +
          (e instanceof Error ? e.message : "unbekannt"),
      );
    } finally {
      setBestaetigeId(null);
    }
  }

  /**
   * Header-Button: alle Buchungen mit identischer Kategorie bestätigen +
   * Lernregel anlegen. Disabled, wenn Kategorien uneinheitlich sind oder
   * keine Kategorie gesetzt ist.
   */
  function alleBestaetigenMitRegel() {
    if (!alleGleicheKategorie || !aktuelleKategorieId) {
      toast.error(
        "Geht nur, wenn alle Buchungen dieselbe Kategorie haben. Vorher 'auf alle anwenden' nutzen oder eine Zeile mit 'Übernehmen' verwenden.",
      );
      return;
    }
    startBulk(async () => {
      try {
        const ids = buchungen.map((b) => b.id);
        const r = await fetch("/api/buchungen/bulk-kategorie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, kategorie_id: aktuelleKategorieId }),
        });
        if (!r.ok) {
          const e = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(e?.error ?? `HTTP ${r.status}`);
        }
        const j = (await r.json()) as BulkKategorieResponse;
        setBuchungen((bs) =>
          bs.map((b) => ({
            ...b,
            kategorie_id: j.kategorie.id,
            kategorie_bezeichnung: j.kategorie.bezeichnung,
            kategorie_typ: j.kategorie.typ,
            status: "manuell_bestaetigt",
          })),
        );

        const regelStatus = await lerneRegelFuer(j.kategorie.id, j.kategorie.typ);
        regelToast(
          regelStatus,
          `Alle ${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} bestätigt`,
        );
        onMutiert?.();
        onZuklappen?.();
      } catch (e) {
        toast.error(
          "Alle bestätigen fehlgeschlagen: " +
            (e instanceof Error ? e.message : "unbekannt"),
        );
      }
    });
  }

  function wendeAuAlleAn() {
    if (bulkKat === "__none__") {
      toast.error("Bitte eine Kategorie auswählen.");
      return;
    }
    const ids = buchungen.map((b) => b.id);
    startBulk(async () => {
      try {
        const r = await fetch("/api/buchungen/bulk-kategorie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, kategorie_id: bulkKat }),
        });
        if (!r.ok) {
          const e = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(e?.error ?? `HTTP ${r.status}`);
        }
        const j = (await r.json()) as BulkKategorieResponse;
        setBuchungen((bs) =>
          bs.map((b) => ({
            ...b,
            kategorie_id: j.kategorie.id,
            kategorie_bezeichnung: j.kategorie.bezeichnung,
            kategorie_typ: j.kategorie.typ,
            status: "manuell_bestaetigt",
          })),
        );
        toast.success(
          `${j.aktualisiert} Buchung${j.aktualisiert === 1 ? "" : "en"} auf "${j.kategorie.bezeichnung}" gesetzt`,
        );
        if (j.uebersprungen.length > 0) {
          toast.warning(
            `${j.uebersprungen.length} Buchung${j.uebersprungen.length === 1 ? "" : "en"} übersprungen (nicht gefunden)`,
          );
        }
        onMutiert?.();
      } catch (e) {
        toast.error(
          "Bulk-Update fehlgeschlagen: " +
            (e instanceof Error ? e.message : "unbekannt"),
        );
      }
    });
  }

  return (
    <div className="space-y-3 px-2">
      {/* Bulk-Aktion */}
      <div className="flex flex-wrap items-end gap-3 rounded-md border bg-background p-3">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Kategorie auf alle anwenden
          </div>
          <div className="flex items-center gap-2">
            <Select value={bulkKat} onValueChange={setBulkKat}>
              <SelectTrigger className="h-9 w-[280px] text-sm">
                <SelectValue placeholder="Kategorie wählen…" />
              </SelectTrigger>
              <SelectContent>
                <KategorieGruppen kategorien={kategorien} />
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={wendeAuAlleAn}
              disabled={bulkBusy || bulkKat === "__none__"}
            >
              {bulkBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              )}
              Auf alle {buchungen.length} anwenden
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={alleBestaetigenMitRegel}
              disabled={
                bulkBusy || !alleGleicheKategorie || !aktuelleKategorieId
              }
              title={
                !alleGleicheKategorie
                  ? "Buchungen haben uneinheitliche Kategorien — vorher 'auf alle anwenden' nutzen"
                  : !aktuelleKategorieId
                    ? "Es ist keine Kategorie gesetzt"
                    : `Alle ${buchungen.length} bestätigen und Regel für "${item.empfaenger}" lernen`
              }
            >
              {bulkBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              )}
              Alle bestätigen & Regel lernen
            </Button>
          </div>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">
          {alleGleicheKategorie && aktuelleKategorieId
            ? `Aktuell: ${kategorien.find((k) => k.id === aktuelleKategorieId)?.bezeichnung ?? "—"}`
            : alleGleicheKategorie
              ? "Aktuell: alle ohne Kategorie"
              : "Buchungen haben uneinheitliche Kategorien"}
        </div>
      </div>

      {/* Buchungs-Liste */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Datum</TableHead>
            <TableHead className="w-[120px]">Konto</TableHead>
            <TableHead className="text-right w-[110px]">Betrag</TableHead>
            <TableHead>Kategorie</TableHead>
            <TableHead className="w-[110px]">Status</TableHead>
            <TableHead className="w-[280px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buchungen.map((b) => (
            <TableRow
              key={b.id}
              className={b.ausreisser ? "bg-amber-50/40 dark:bg-amber-950/20" : ""}
            >
              <TableCell className="tabular-nums text-sm">
                <div className="flex items-center gap-1.5">
                  <span>{deDate(b.buchung_datum)}</span>
                  {b.ausreisser ? (
                    <Badge
                      variant="outline"
                      className="border-amber-500 text-[10px] text-amber-700 dark:text-amber-400"
                      title="Weicht stark vom Cluster-Median ab"
                    >
                      Ausreißer
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {b.konto_bezeichnung}
              </TableCell>
              <TableCell
                className={
                  "text-right tabular-nums font-mono text-sm " +
                  (b.ausreisser
                    ? "text-amber-700 dark:text-amber-400"
                    : b.betrag < 0
                      ? "text-destructive"
                      : "text-emerald-600 dark:text-emerald-400")
                }
              >
                {eur(b.betrag)}
              </TableCell>
              <TableCell>
                <Select
                  disabled={savingId === b.id}
                  value={b.kategorie_id ?? "__none__"}
                  onValueChange={(v) =>
                    v !== "__none__" && aendereEinzeln(b, v)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue
                      placeholder={b.kategorie_bezeichnung ?? "— ohne —"}
                    >
                      <span className="flex items-center gap-2 truncate">
                        {b.kategorie_typ ? (
                          <Badge
                            variant={
                              TYP_BADGE[b.kategorie_typ] ?? "outline"
                            }
                            className="text-[10px]"
                          >
                            {TYP_LABEL[b.kategorie_typ] ?? b.kategorie_typ}
                          </Badge>
                        ) : null}
                        <span className="truncate">
                          {b.kategorie_bezeichnung ?? "— ohne —"}
                        </span>
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <KategorieGruppen kategorien={kategorien} />
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {b.status === "manuell_bestaetigt" ? (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <CheckCircle2 className="h-3 w-3" />
                    bestätigt
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs">
                    {b.status}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => bestaetigeUndLerne(b)}
                    disabled={
                      bestaetigeId === b.id ||
                      savingId === b.id ||
                      bulkBusy ||
                      !b.kategorie_id ||
                      b.status === "manuell_bestaetigt"
                    }
                    title={
                      !b.kategorie_id
                        ? "Erst Kategorie wählen"
                        : b.status === "manuell_bestaetigt"
                          ? "Bereits bestätigt"
                          : `Bestätigen und Regel für "${item.empfaenger}" lernen`
                    }
                  >
                    {bestaetigeId === b.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCheck className="h-3.5 w-3.5" />
                    )}
                    Bestätigen
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => uebernehmeKategorieUndBestaetige(b)}
                    disabled={
                      bestaetigeId === b.id ||
                      savingId === b.id ||
                      bulkBusy ||
                      !b.kategorie_id ||
                      buchungen.length <= 1
                    }
                    title={
                      !b.kategorie_id
                        ? "Diese Buchung hat noch keine Kategorie"
                        : buchungen.length <= 1
                          ? "Nur eine Buchung in dieser Gruppe"
                          : `Kategorie "${b.kategorie_bezeichnung ?? "—"}" auf alle ${buchungen.length} anwenden und Regel lernen`
                    }
                  >
                    {bestaetigeId === b.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Für alle
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onOpenSheet(b.id)}
                    title="Volle Details öffnen"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function KategorieGruppen({
  kategorien,
}: {
  kategorien: KategorieOption[];
}) {
  const gruppen: Record<KategorieTyp, KategorieOption[]> = {
    einnahme: [],
    ausgabe: [],
    privat: [],
    neutral: [],
  };
  for (const k of kategorien) gruppen[k.typ].push(k);
  const labels: Record<KategorieTyp, string> = {
    einnahme: "Einnahmen",
    ausgabe: "Ausgaben",
    privat: "Privat",
    neutral: "Neutral",
  };
  const reihenfolge: KategorieTyp[] = [
    "einnahme",
    "ausgabe",
    "privat",
    "neutral",
  ];
  return (
    <>
      {reihenfolge.map((typ) =>
        gruppen[typ].length === 0 ? null : (
          <SelectGroup key={typ}>
            <SelectLabel>{labels[typ]}</SelectLabel>
            {gruppen[typ]
              .slice()
              .sort((a, b) => a.bezeichnung.localeCompare(b.bezeichnung))
              .map((k) => (
                <SelectItem key={k.id} value={k.id}>
                  {k.bezeichnung}
                </SelectItem>
              ))}
          </SelectGroup>
        ),
      )}
    </>
  );
}
