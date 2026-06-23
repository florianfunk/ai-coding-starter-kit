// Neues Dashboard im Editorial-Stil. Loest die alte DashboardGrid ab.
//
// Layout-Hierarchie (von wichtig zu Detail):
//   1. Jetzt zu tun       — Action-Items als kompakte Editorial-Rows.
//   2. Snapshot           — KPI-Block mit den vier zentralen Jahres-Zahlen.
//   3. Periodenstatus     — Tabelle der USt-VA-/Wirtschaftsjahre.
//   4. Letzte Aktivitaet  — Paperless-Sync + Konto-Import nebeneinander.
//
// Komponente ist server-renderbar — keine Daten werden hier nachgeladen.

import Link from "next/link";
import {
  CheckCircle2,
  ChevronRight,
  FileQuestion,
  FileSearch,
  ListChecks,
} from "lucide-react";

import {
  EditorialRow,
  Section,
  StatBlock,
} from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";

import type {
  DashboardAggregat,
  PeriodenZeile,
  SyncStatus,
} from "@/lib/dashboard/aggregate";
import { formatDatum, formatEuro, formatZahl, formatZeitpunkt } from "./format";
import { HealthScoreCard } from "./health-score-card";
import { FristenCountdown } from "./fristen-countdown";
import { AktivitaetFeed } from "./aktivitaet-feed";

// ---------------------------------------------------------------------------
// Action-Item: eine Zeile in "Jetzt zu tun"
// ---------------------------------------------------------------------------

function ActionItem({
  titel,
  beschreibung,
  anzahl,
  href,
  icon,
  alarm,
}: {
  titel: string;
  beschreibung: string;
  anzahl: number;
  href: string;
  icon: React.ReactNode;
  /** true → bei Anzahl > 0 visuell hervorheben (rot). */
  alarm?: boolean;
}) {
  const offen = anzahl > 0;
  const ist_alarm = !!alarm && offen;

  return (
    <EditorialRow
      href={href}
      leading={
        <div
          className={
            "flex h-9 w-9 items-center justify-center rounded-[10px] " +
            (ist_alarm
              ? "bg-tint-cerise text-destructive"
              : offen
                ? "bg-tint-yellow text-highlight-strong"
                : "bg-tint-cyan text-income-strong")
          }
          aria-hidden
        >
          {offen ? icon : <CheckCircle2 className="h-4 w-4" />}
        </div>
      }
      main={
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold leading-tight">
              {titel}
            </span>
            {!offen ? (
              <Badge
                variant="secondary"
                className="rounded-full bg-tint-cyan text-[10px] text-income-strong"
              >
                erledigt
              </Badge>
            ) : null}
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {beschreibung}
          </div>
        </div>
      }
      meta={
        <div className="text-right">
          <div
            className={
              "font-mono text-[22px] font-bold tabular-nums leading-none " +
              (ist_alarm
                ? "text-destructive"
                : offen
                  ? "text-highlight-strong"
                  : "text-muted-foreground")
            }
          >
            {formatZahl(anzahl)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {offen ? "offen" : "alle erledigt"}
          </div>
        </div>
      }
      trailing={<ChevronRight className="h-4 w-4 text-line-strong" />}
    />
  );
}

// ---------------------------------------------------------------------------
// Sync-Row: kompakte Aktivitaets-Zeile
// ---------------------------------------------------------------------------

function SyncRow({
  titel,
  status,
  href,
}: {
  titel: string;
  status: SyncStatus;
  href: string;
}) {
  return (
    <EditorialRow
      href={href}
      main={
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold leading-tight">
              {titel}
            </span>
            {!status.vorhanden ? (
              <Badge
                variant="secondary"
                className="rounded-full bg-[color:var(--surface-2)] text-[10px] text-muted-foreground"
              >
                noch nie
              </Badge>
            ) : status.ist_fehler ? (
              <Badge
                variant="destructive"
                className="rounded-full text-[10px]"
              >
                Fehler
              </Badge>
            ) : status.status === "laeuft" ? (
              <Badge
                variant="secondary"
                className="rounded-full bg-tint-yellow text-[10px] text-highlight-strong"
              >
                läuft
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="rounded-full bg-tint-cyan text-[10px] text-income-strong"
              >
                ok
              </Badge>
            )}
          </div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            {status.vorhanden ? (
              <>Letzter Lauf {formatZeitpunkt(status.zeitpunkt)}</>
            ) : (
              <>Noch kein Lauf durchgeführt</>
            )}
          </div>
          {status.ist_fehler && status.fehler_text ? (
            <div className="mt-1 text-[11px] text-destructive">
              {status.fehler_text}
            </div>
          ) : null}
        </div>
      }
      trailing={<ChevronRight className="h-4 w-4 text-line-strong" />}
    />
  );
}

// ---------------------------------------------------------------------------
// Periodenstatus-Block
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<"offen" | "geprueft" | "abgeschlossen", string> = {
  offen: "Offen",
  geprueft: "Geprüft",
  abgeschlossen: "Abgeschlossen",
};

function ziel(z: PeriodenZeile): string {
  return z.art === "wirtschaftsjahr"
    ? `/euer?jahr=${z.jahr}`
    : `/ust-voranmeldung?jahr=${z.jahr}`;
}

function PeriodenBlock({ perioden }: { perioden: PeriodenZeile[] }) {
  if (perioden.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-[13px] text-muted-foreground">
        Noch keine Steuerperioden — sie entstehen automatisch mit der ersten
        USt-VA bzw. Jahres-EÜR.
      </div>
    );
  }
  // iOS-Style: Apple-Listen-Sektion (jede Zeile clickbar, ChevronRight rechts).
  return (
    <ul role="list" className="divide-y divide-line-hair">
      {perioden.map((z) => (
        <li key={`${z.art}-${z.jahr}-${z.periode ?? "j"}`}>
          <Link
            href={ziel(z)}
            className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[color:var(--surface-2)]"
          >
            <span className="flex-1 text-[14px] font-medium">{z.label}</span>
            <Badge
              variant="secondary"
              className={
                "rounded-full text-[10px] " +
                (z.status === "offen"
                  ? "bg-tint-yellow text-highlight-strong"
                  : z.status === "geprueft"
                    ? "bg-tint-cyan text-income-strong"
                    : "bg-[color:var(--surface-2)] text-muted-foreground")
              }
            >
              {STATUS_LABEL[z.status]}
            </Badge>
            <ChevronRight className="h-4 w-4 text-line-strong" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Hauptkomponente
// ---------------------------------------------------------------------------

export function DashboardEditorial({ data }: { data: DashboardAggregat }) {
  const {
    aktionen,
    jahr,
    perioden,
    paperless_sync,
    konto_import,
    fristen,
    health_score,
    aktivitaet,
  } = data;
  const verlust = jahr.vorlaeufiger_gewinn < 0;
  const erstattung = jahr.voraussichtliche_ust_zahllast < 0;
  const offeneTasks =
    aktionen.offene_prueffaelle +
    aktionen.fehlende_belege +
    aktionen.unklassifiziert;

  return (
    <div className="space-y-7">
      {/* 0) Cockpit — Health-Score + USt-VA-Fristen-Countdown (PROJ-27 AC6) */}
      <Section
        eyebrow="Cockpit"
        titel="Stand & Fristen"
        beschreibung="Wie weit deine Buchhaltung ist und wann die nächste USt-VA fällig wird."
        innerCard={false}
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60 lg:col-span-2">
            <HealthScoreCard data={health_score} />
          </div>
          <div className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
            <FristenCountdown fristen={fristen} />
          </div>
        </div>
      </Section>

      {/* 1) Jetzt zu tun — iOS-Settings-Karte mit Listen-Eintraegen */}
      <Section
        eyebrow="Jetzt zu tun"
        titel="Was Aufmerksamkeit braucht"
        beschreibung={
          offeneTasks === 0
            ? "Aktuell ist nichts offen — alles klassifiziert und belegt."
            : `${formatZahl(offeneTasks)} Einträge warten auf eine Aktion.`
        }
        innerCard={false}
      >
        <div className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
          <div className="divide-y divide-line-hair">
            <ActionItem
              titel="Offene Prüffälle"
              beschreibung="Buchungen, die der Agent nicht sicher zuordnen konnte."
              anzahl={aktionen.offene_prueffaelle}
              href="/pruefliste"
              icon={<ListChecks className="h-4 w-4" />}
              alarm
            />
            <ActionItem
              titel="Fehlende Belege"
              beschreibung="Geschäftliche Buchungen ohne zugeordneten Beleg."
              anzahl={aktionen.fehlende_belege}
              href="/abgleich"
              icon={<FileQuestion className="h-4 w-4" />}
              alarm
            />
            <ActionItem
              titel="Unklassifizierte Buchungen"
              beschreibung="Noch nicht klassifizierte (offene) Buchungen."
              anzahl={aktionen.unklassifiziert}
              href="/buchungen"
              icon={<FileSearch className="h-4 w-4" />}
            />
          </div>
        </div>
      </Section>

      {/* 2) Snapshot — KPI-Karte, vier Zahlen mit Hairline-Trennlinien */}
      <Section
        eyebrow={
          <span>
            Snapshot · Wirtschaftsjahr {jahr.jahr}{" "}
            <span className="text-[color:var(--text-subtle)] font-normal normal-case tracking-normal">
              ({formatDatum(jahr.zeitraum.von)} – {formatDatum(jahr.zeitraum.bis)})
            </span>
          </span>
        }
        titel="Laufendes Jahr"
        beschreibung="Vorläufige Summen aus aktuell klassifizierten Buchungen. Verbindliche Werte liefern EÜR und USt-VA."
        actions={
          <Badge
            variant="secondary"
            className="rounded-full bg-tint-yellow text-foreground"
          >
            vorläufig
          </Badge>
        }
        innerCard={false}
      >
        <div className="rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
          <div className="grid grid-cols-2 divide-x divide-y divide-line-hair sm:grid-cols-4 sm:divide-y-0">
            <div className="px-5 py-5">
              <StatBlock
                label="Betriebseinnahmen"
                wert={formatEuro(jahr.einnahmen)}
                sub={`${formatZahl(jahr.anzahl_buchungen)} geschäftlich →`}
                tone="income"
                size="lg"
                href="/kategorien-analyse"
              />
            </div>
            <div className="px-5 py-5">
              <StatBlock
                label="Betriebsausgaben"
                wert={formatEuro(jahr.ausgaben)}
                tone="expense"
                size="lg"
                href="/kategorien-analyse"
                sub="Aufschlüsselung →"
              />
            </div>
            <div className="px-5 py-5">
              <StatBlock
                label={verlust ? "Vorläufiger Verlust" : "Vorläufiger Gewinn"}
                wert={formatEuro(jahr.vorlaeufiger_gewinn)}
                tone={verlust ? "expense" : "income"}
                size="lg"
                href="/euer"
                sub="Zur EÜR →"
              />
            </div>
            <div className="px-5 py-5">
              <StatBlock
                label={
                  erstattung
                    ? "Voraussichtl. USt-Erstattung"
                    : "Voraussichtl. USt-Zahllast"
                }
                wert={formatEuro(jahr.voraussichtliche_ust_zahllast)}
                tone={erstattung ? "income" : "expense"}
                size="lg"
                href="/ust-voranmeldung"
                sub="Zur USt-VA →"
              />
            </div>
          </div>
        </div>
        <p className="mt-3 px-1 text-[12px] text-muted-foreground">
          Vorläufige Schätzung. Die deterministischen Steuer-Module (EÜR,
          USt-VA) liefern verbindliche Werte.
        </p>
      </Section>

      {/* 3) Periodenstatus */}
      <Section
        eyebrow="Steuer"
        titel="Periodenstatus"
        beschreibung="Bearbeitungsstand je USt-VA-Periode und Wirtschaftsjahr."
        innerCard={false}
      >
        <div className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
          <PeriodenBlock perioden={perioden} />
        </div>
      </Section>

      {/* 4) Was ist passiert? — Aktivitäts-Feed (PROJ-27 AC6) */}
      <Section
        eyebrow="Aktivität"
        titel="Was ist passiert?"
        beschreibung="Die letzten Aktionen des Agenten — Importe, Syncs und Klassifizierungen."
        innerCard={false}
      >
        <div className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
          <AktivitaetFeed eintraege={aktivitaet} />
        </div>
      </Section>

      {/* 5) Letzte Imports & Syncs — Sync-Status je Quelle */}
      <Section
        eyebrow="Quellen"
        titel="Letzte Imports & Syncs"
        beschreibung="Wann zuletzt Belege bzw. Kontoauszüge gezogen wurden."
        innerCard={false}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
            <SyncRow
              titel="Paperless-Sync"
              status={paperless_sync}
              href="/einstellungen/paperless"
            />
          </div>
          <div className="overflow-hidden rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
            <SyncRow
              titel="Kontoimport"
              status={konto_import}
              href="/einstellungen/konten"
            />
          </div>
        </div>
      </Section>
    </div>
  );
}
