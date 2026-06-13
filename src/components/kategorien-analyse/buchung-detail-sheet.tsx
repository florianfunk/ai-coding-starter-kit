"use client";

// PROJ-14 — Detail-Sheet für eine einzelne Buchung. Zeigt ALLE
// Datenfelder, verlinkte Paperless-Belege und die Audit-Historie.
// Lädt sich selbst nach beim Öffnen.
//
// Mutation läuft über das bestehende PATCH /api/buchungen/[id] —
// Kategorie-Wechsel, "manuell bestätigen", USt-Satz ändern.

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  BuchungDetail,
  BelegLink,
  AuditEintrag,
} from "@/app/api/buchungen/[id]/detail/route";
import type { KategorieTyp } from "@/lib/types";

interface KategorieOption {
  id: string;
  bezeichnung: string;
  typ: KategorieTyp;
  aktiv: boolean;
}

function eur(n: number | null): string {
  if (n === null) return "—";
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
function deDatetime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABEL: Record<BuchungDetail["status"], string> = {
  offen: "Offen",
  auto_verbucht: "Auto-verbucht",
  zur_pruefung: "Zur Prüfung",
  manuell_bestaetigt: "Manuell bestätigt",
};
const STATUS_VARIANT: Record<
  BuchungDetail["status"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  offen: "outline",
  auto_verbucht: "default",
  zur_pruefung: "destructive",
  manuell_bestaetigt: "secondary",
};

const QUELLE_LABEL: Record<NonNullable<BuchungDetail["quelle"]>, string> = {
  regel: "Regel",
  ki: "KI",
  manuell: "Manuell",
};

export function BuchungDetailSheet({
  buchungId,
  kategorien,
  onClose,
  onMutiert,
}: {
  buchungId: string | null;
  kategorien: KategorieOption[];
  onClose: () => void;
  onMutiert: () => void;
}) {
  const offen = buchungId !== null;
  const [daten, setDaten] = useState<BuchungDetail | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!buchungId) {
      setDaten(null);
      return;
    }
    setFehler(null);
    startTransition(async () => {
      try {
        const r = await fetch(`/api/buchungen/${buchungId}/detail`);
        if (!r.ok) {
          const e = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(e?.error ?? `HTTP ${r.status}`);
        }
        setDaten((await r.json()) as BuchungDetail);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
        setFehler(msg);
      }
    });
  }, [buchungId]);

  async function patch(body: Record<string, unknown>) {
    if (!buchungId) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/buchungen/${buchungId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(e?.error ?? `HTTP ${r.status}`);
      }
      // Detail neu laden (für Audit-Eintrag + neue Werte)
      const reload = await fetch(`/api/buchungen/${buchungId}/detail`);
      if (reload.ok) setDaten((await reload.json()) as BuchungDetail);
      toast.success("Gespeichert");
      onMutiert();
    } catch (e) {
      toast.error("Fehler: " + (e instanceof Error ? e.message : "unbekannt"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={offen} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[680px] sm:w-[90vw]">
        <SheetHeader>
          <SheetTitle>Buchungs-Details</SheetTitle>
          <SheetDescription>
            {daten ? (
              <>
                {deDate(daten.buchung_datum)} · {daten.konto_bezeichnung}
              </>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        {fehler ? (
          <p className="mt-6 text-sm text-destructive">{fehler}</p>
        ) : !daten ? (
          <p className="mt-6 text-sm text-muted-foreground">
            {isPending ? "Lade Details…" : ""}
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            <KopfBetrag daten={daten} />
            <Kerndaten daten={daten} />
            <SteuerBlock daten={daten} kategorien={kategorien} onPatch={patch} saving={saving} />
            <KIBlock daten={daten} />
            <BelegeBlock belege={daten.belege} />
            <AuditBlock audit={daten.audit} />
            <Aktionen daten={daten} onPatch={patch} saving={saving} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function KopfBetrag({ daten }: { daten: BuchungDetail }) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-baseline justify-between">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Betrag
          </div>
          <div
            className={
              "text-3xl font-bold tabular-nums " +
              (daten.betrag < 0
                ? "text-destructive"
                : "text-income-strong dark:text-income")
            }
          >
            {eur(daten.betrag)}{" "}
            <span className="text-base font-normal text-muted-foreground">
              {daten.waehrung}
            </span>
          </div>
        </div>
        <Badge variant={STATUS_VARIANT[daten.status]}>
          {STATUS_LABEL[daten.status]}
        </Badge>
      </div>
      {daten.pruef_grund ? (
        <p className="mt-3 text-xs text-destructive">⚠ {daten.pruef_grund}</p>
      ) : null}
    </div>
  );
}

function Kerndaten({ daten }: { daten: BuchungDetail }) {
  const items: Array<{ label: string; wert: React.ReactNode }> = [
    { label: "Empfänger", wert: daten.empfaenger ?? "—" },
    {
      label: "Verwendungszweck",
      wert: daten.verwendungszweck ? (
        <span className="whitespace-pre-wrap break-words">
          {daten.verwendungszweck}
        </span>
      ) : (
        "—"
      ),
    },
    { label: "Konto", wert: daten.konto_bezeichnung },
    { label: "Datum", wert: deDate(daten.buchung_datum) },
    {
      label: "Import-Quelle",
      wert: daten.import_quelle ?? "—",
    },
    {
      label: "Buchung-ID",
      wert: (
        <span className="font-mono text-xs">{daten.id}</span>
      ),
    },
  ];
  return (
    <Section titel="Kerndaten">
      <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-sm">
        {items.map((it) => (
          <FeldZeile key={it.label} label={it.label} wert={it.wert} />
        ))}
      </dl>
    </Section>
  );
}

function SteuerBlock({
  daten,
  kategorien,
  onPatch,
  saving,
}: {
  daten: BuchungDetail;
  kategorien: KategorieOption[];
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  const klassLabel: Record<NonNullable<BuchungDetail["klassifikation"]>, string> = {
    privat: "Privat",
    geschaeftlich: "Geschäftlich",
    unklar: "Unklar",
    neutral: "Neutral",
  };

  return (
    <Section titel="Steuer / Kategorie">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-[140px_1fr] items-center gap-3">
          <Label htmlFor="kat-edit">Kategorie</Label>
          <Select
            disabled={saving}
            value={daten.kategorie_id ?? "__none__"}
            onValueChange={(v) =>
              v !== "__none__" &&
              onPatch({ kategorie_id: v, bestaetigen: true })
            }
          >
            <SelectTrigger id="kat-edit" className="h-9">
              <SelectValue placeholder={daten.kategorie_bezeichnung ?? "— ohne —"} />
            </SelectTrigger>
            <SelectContent>
              <KategorieGruppen kategorien={kategorien} />
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-[140px_1fr] items-center gap-3">
          <Label htmlFor="ust-edit">USt-Satz</Label>
          <Select
            disabled={saving}
            value={daten.ust_satz === null ? "__keep__" : String(daten.ust_satz)}
            onValueChange={(v) =>
              v !== "__keep__" && onPatch({ ust_satz: Number(v) })
            }
          >
            <SelectTrigger id="ust-edit" className="h-9 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">0 %</SelectItem>
              <SelectItem value="7">7 %</SelectItem>
              <SelectItem value="19">19 %</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-[140px_1fr] items-center gap-3">
          <Label htmlFor="klass-edit">Klassifikation</Label>
          <Select
            disabled={saving}
            value={daten.klassifikation ?? "__none__"}
            onValueChange={(v) =>
              v !== "__none__" &&
              onPatch({
                klassifikation: v as NonNullable<BuchungDetail["klassifikation"]>,
              })
            }
          >
            <SelectTrigger id="klass-edit" className="h-9 w-[180px]">
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              {(["geschaeftlich", "privat", "neutral", "unklar"] as const).map(
                (k) => (
                  <SelectItem key={k} value={k}>
                    {klassLabel[k]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 pt-2">
          <FeldZeile
            label="Steuerrelevant"
            wert={
              daten.steuerrelevant === null
                ? "—"
                : daten.steuerrelevant
                  ? "ja"
                  : "nein"
            }
          />
          <FeldZeile
            label="Kategorie-Typ"
            wert={daten.kategorie_typ ?? "—"}
          />
        </dl>
      </div>
    </Section>
  );
}

function KIBlock({ daten }: { daten: BuchungDetail }) {
  if (!daten.begruendung && !daten.quelle && daten.konfidenz === null) {
    return null;
  }
  return (
    <Section titel="Entscheidung des Agenten" icon={<Sparkles className="h-4 w-4" />}>
      <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-2 text-sm">
        <FeldZeile
          label="Quelle"
          wert={
            daten.quelle ? (
              <Badge variant="outline" className="text-xs">
                {QUELLE_LABEL[daten.quelle]}
                {daten.regel_bezeichnung
                  ? ` · ${daten.regel_bezeichnung}`
                  : ""}
              </Badge>
            ) : (
              "—"
            )
          }
        />
        <FeldZeile
          label="Konfidenz"
          wert={
            daten.konfidenz === null
              ? "—"
              : `${Math.round(daten.konfidenz * 100)} %`
          }
        />
        {daten.begruendung ? (
          <FeldZeile
            label="Begründung"
            wert={
              <span className="whitespace-pre-wrap text-muted-foreground">
                {daten.begruendung}
              </span>
            }
          />
        ) : null}
      </dl>
    </Section>
  );
}

function BelegeBlock({ belege }: { belege: BelegLink[] }) {
  return (
    <Section
      titel={`Belege (${belege.length})`}
      icon={<FileText className="h-4 w-4" />}
    >
      {belege.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Kein Paperless-Beleg zugeordnet.
        </p>
      ) : (
        <ul className="space-y-3">
          {belege.map((b) => (
            <li
              key={b.beleg_id}
              className="rounded-md border p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">
                    {b.titel ?? `Beleg #${b.paperless_id}`}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {b.korrespondent ?? "—"} · {deDate(b.beleg_datum)} ·{" "}
                    {eur(b.betrag)}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge
                    variant={
                      b.match_status === "manuell"
                        ? "secondary"
                        : b.match_status === "unsicher"
                          ? "destructive"
                          : "default"
                    }
                    className="text-xs"
                  >
                    {b.match_status}
                    {b.match_score !== null
                      ? ` · ${Math.round(b.match_score * 100)} %`
                      : ""}
                  </Badge>
                  {b.gesperrt ? (
                    <Badge variant="outline" className="text-[10px]">
                      gesperrt
                    </Badge>
                  ) : null}
                </div>
              </div>
              {b.quell_link ? (
                <a
                  href={b.quell_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  In Paperless öffnen
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function AuditBlock({ audit }: { audit: AuditEintrag[] }) {
  return (
    <Section titel={`Audit-Historie (${audit.length})`}>
      {audit.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Noch keine Änderungen aufgezeichnet.
        </p>
      ) : (
        <ol className="space-y-2">
          {audit.map((a) => (
            <li
              key={a.id}
              className="rounded-md border bg-muted/30 p-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{a.aktion}</span>
                <span className="text-muted-foreground">
                  {deDatetime(a.created_at)}
                </span>
              </div>
              {a.quelle ? (
                <div className="mt-0.5 text-muted-foreground">
                  Quelle: {a.quelle}
                </div>
              ) : null}
              {a.details ? (
                <pre className="mt-1.5 max-h-[140px] overflow-auto whitespace-pre-wrap break-words rounded bg-background p-1.5 text-[11px]">
                  {JSON.stringify(a.details, null, 2)}
                </pre>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function Aktionen({
  daten,
  onPatch,
  saving,
}: {
  daten: BuchungDetail;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  saving: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-t pt-4">
      {daten.status !== "manuell_bestaetigt" ? (
        <Button
          onClick={() => onPatch({ bestaetigen: true })}
          disabled={saving}
        >
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
          )}
          Manuell bestätigen
        </Button>
      ) : null}
    </div>
  );
}

function Section({
  titel,
  icon,
  children,
}: {
  titel: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {titel}
      </h3>
      {children}
    </section>
  );
}

function FeldZeile({
  label,
  wert,
}: {
  label: string;
  wert: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{wert}</dd>
    </>
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
