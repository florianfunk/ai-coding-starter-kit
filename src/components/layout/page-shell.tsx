/**
 * Editorial-Design-System fuer die App-Seiten.
 *
 * Ziel: konsistente Hierarchie ueber alle Seiten — Page-Header,
 * Section-Eyebrows, KPI-Bloecke und horizontale Linien statt Boxen-Walls.
 * Anlehnung an den Cobalt-Sidebar-Stil (Source Serif fuer Anzeigen-Schrift,
 * Caps-Eyebrows, Haarlinien).
 *
 * Wichtig: shadcn-Primitives wo immer moeglich (Button, Card, Badge,
 * Separator, ...). Diese Datei fuegt nur die Layout-Schalen hinzu.
 */

import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PageShell: aeusserer Wrapper um eine gesamte App-Seite
// ---------------------------------------------------------------------------

export function PageShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("space-y-8", className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// PageHeader: Titel + Beschreibung + optionale Actions
// ---------------------------------------------------------------------------

export function PageHeader({
  eyebrow,
  titel,
  beschreibung,
  actions,
}: {
  /** Kleine Caps-Zeile ueber dem Titel — Kontext oder Sektion. */
  eyebrow?: ReactNode;
  titel: ReactNode;
  beschreibung?: ReactNode;
  /** Buttons rechts (Desktop) bzw. unten (Mobile). */
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1
          className={cn(
            "font-display text-[40px] font-bold leading-[1.05] tracking-[-0.024em] text-foreground",
            eyebrow ? "mt-1.5" : "",
          )}
        >
          {titel}
        </h1>
        {beschreibung ? (
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {beschreibung}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Section: thematischer Block innerhalb einer Seite
// ---------------------------------------------------------------------------

// `SectionTint` bleibt aus Kompat-Gruenden erhalten, ist aber NICHT mehr
// ein Hintergrund-Wash. Stattdessen faerbt es nur noch den Eyebrow-Text
// (sehr subtiler Marken-Akzent im iOS-17-Stil).
export type SectionTint =
  | "none"
  | "violet"
  | "yellow"
  | "cyan"
  | "cerise"
  | "gray";

const EYEBROW_TONE: Record<SectionTint, "default" | "warning" | "success" | "destructive" | "muted"> = {
  none: "muted",
  violet: "default",
  yellow: "warning",
  cyan: "success",
  cerise: "destructive",
  gray: "muted",
};

export function Section({
  eyebrow,
  titel,
  beschreibung,
  actions,
  children,
  className,
  tint = "none",
  innerCard = true,
}: {
  eyebrow?: ReactNode;
  titel?: ReactNode;
  beschreibung?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Faerbt nur noch den Eyebrow-Text — kein Hintergrund mehr. */
  tint?: SectionTint;
  /** true (Default) → Inhalt landet in einer weissen Karte (iOS-Settings).
      false → Inhalt steht frei (etwa bei eigenen Listen-Gruppen). */
  innerCard?: boolean;
}) {
  const hatHeader = !!(eyebrow || titel || beschreibung || actions);
  return (
    <section className={cn("space-y-3", className)}>
      {hatHeader ? (
        <div
          className={cn(
            "flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between",
          )}
        >
          <div className="min-w-0">
            {eyebrow ? (
              <Eyebrow tone={EYEBROW_TONE[tint]}>{eyebrow}</Eyebrow>
            ) : null}
            {titel ? (
              <h2
                className={cn(
                  "font-display text-[20px] font-bold leading-tight tracking-[-0.018em]",
                  eyebrow ? "mt-1" : "",
                )}
              >
                {titel}
              </h2>
            ) : null}
            {beschreibung ? (
              <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
                {beschreibung}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      {innerCard ? (
        <div className="rounded-[var(--radius)] bg-card shadow-[var(--shadow-1)] ring-1 ring-line/60">
          {children}
        </div>
      ) : (
        <div>{children}</div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Eyebrow: kleine Caps-Zeile, das Markenzeichen des Editorial-Stils
// ---------------------------------------------------------------------------

export function Eyebrow({
  children,
  className,
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "success" | "warning" | "muted" | "destructive";
}) {
  const toneCls = {
    default: "text-foreground",
    success: "text-income-strong dark:text-income",
    warning: "text-highlight-strong dark:text-highlight",
    muted: "text-[color:var(--text-subtle)]",
    destructive: "text-destructive",
  }[tone];
  return (
    <div
      className={cn(
        "text-[10px] font-extrabold uppercase tracking-[0.18em]",
        toneCls,
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatBlock: ein einzelner KPI mit Label + grosser Zahl + optionaler Sub
// ---------------------------------------------------------------------------

export function StatBlock({
  label,
  wert,
  sub,
  tone = "default",
  size = "md",
  href,
  className,
  tint = false,
}: {
  label: ReactNode;
  wert: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "income" | "expense" | "neutral" | "muted";
  size?: "sm" | "md" | "lg";
  /** Optional: macht den ganzen Block klickbar. */
  href?: string;
  className?: string;
  /** true → Hintergrund-Tint passend zum tone (income=cyan, expense=cerise, ...). */
  tint?: boolean;
}) {
  const wertCls = cn(
    "font-mono font-bold tabular-nums leading-tight",
    {
      sm: "text-[15px]",
      md: "text-xl",
      lg: "text-[26px]",
    }[size],
    {
      default: "text-foreground",
      income: "text-income-strong dark:text-income",
      expense: "text-destructive",
      neutral: "text-foreground",
      muted: "text-muted-foreground",
    }[tone],
  );

  // Apple-Style StatBlock: keine farbigen Hintergruende mehr. Wenn `tint`
  // aktiv ist, bekommt das Label-Eyebrow eine subtile Marken-Farbe und
  // links daneben sitzt ein kleiner gefuellter Marker — sonst neutral.
  const markerCls = tint
    ? {
        default: "bg-foreground/15",
        income: "bg-income",
        expense: "bg-destructive",
        neutral: "bg-brand-violet",
        muted: "bg-foreground/15",
      }[tone]
    : "";

  const inhalt = (
    <>
      <div className="flex items-center gap-1.5">
        {tint ? (
          <span
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", markerCls)}
            aria-hidden
          />
        ) : null}
        <Eyebrow tone="muted">{label}</Eyebrow>
      </div>
      <div className={cn("mt-1.5", wertCls)}>{wert}</div>
      {sub ? (
        <div className="mt-1 text-[12px] text-muted-foreground">{sub}</div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "group block rounded-[var(--radius-inner)] -mx-2 px-3 py-2 transition-colors hover:bg-[color:var(--surface-2)]",
          className,
        )}
      >
        {inhalt}
      </Link>
    );
  }

  return <div className={cn(className)}>{inhalt}</div>;
}

// ---------------------------------------------------------------------------
// StatGrid: horizontale Reihe von StatBlocks mit Haarlinien-Trennern
// ---------------------------------------------------------------------------

export function StatGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-4",
        "[&>*]:relative",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditorialRow: kompakte Listen-Zeile (wie im Abo-Radar)
//
// Slots: leading (Icon/Indikator) · main (Name + Subzeile) · meta (Zahlen
// rechts) · trailing (Aktion/Chevron).
// ---------------------------------------------------------------------------

export function EditorialRow({
  leading,
  main,
  meta,
  trailing,
  accent,
  tint = false,
  onClick,
  href,
  className,
}: {
  leading?: ReactNode;
  main: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  /** Linker Akzentstrich — z. B. fuer Richtung Einnahme/Ausgabe. */
  accent?: "income" | "expense" | "warning" | "muted";
  /** true → zusaetzlich passender Tint-Hintergrund. */
  tint?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  // Apple-Listen-Stil: kein farbiger Akzent-Streifen mehr per Default.
  // Das `accent`-Argument waehlt nur noch eine sehr subtile linke Bar
  // (1px) — nur sichtbar, wenn explizit gefordert. Tint-Backgrounds sind
  // raus, statt dessen Hover auf Surface-2.
  const accentBar = accent && tint
    ? {
        income: "before:bg-income",
        expense: "before:bg-destructive",
        warning: "before:bg-highlight",
        muted: "before:bg-foreground/15",
      }[accent]
    : "";

  const inhalt = (
    <div
      className={cn(
        "relative flex items-center gap-3 px-4 py-3",
        tint && accent && cn(
          "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-r",
          accentBar,
        ),
        (onClick || href) && "transition-colors hover:bg-[color:var(--surface-2)]",
        className,
      )}
    >
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <div className="min-w-0 flex-1">{main}</div>
      {meta ? (
        <div className="hidden shrink-0 items-center gap-6 text-right sm:flex">
          {meta}
        </div>
      ) : null}
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {inhalt}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left"
      >
        {inhalt}
      </button>
    );
  }
  return inhalt;
}

// ---------------------------------------------------------------------------
// EmptyState: konsistenter Leerzustand
// ---------------------------------------------------------------------------

export function EmptyState({
  titel,
  beschreibung,
  action,
  icon,
}: {
  titel: ReactNode;
  beschreibung?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed py-12 text-center">
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <div className="font-display text-base font-medium">{titel}</div>
      {beschreibung ? (
        <p className="max-w-md text-sm text-muted-foreground">{beschreibung}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
