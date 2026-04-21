import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  LayoutGrid, Layers, Package, TrendingUp,
  FileDown, Settings, Sparkles, LayoutTemplate, ArrowRight,
  CheckCircle, AlertTriangle,
} from "lucide-react";
import { completenessBarClass } from "@/lib/completeness";
import { getDashboardStats } from "@/lib/cache";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stats = await getDashboardStats();

  // Fallback-Werte falls View nicht erreichbar (z.B. DB-Fehler).
  const bereicheCount   = stats?.bereiche_count   ?? 0;
  const kategorienCount = stats?.kategorien_count ?? 0;
  const produkteCount   = stats?.produkte_count   ?? 0;
  const preiseCount     = stats?.preise_count     ?? 0;
  const iconsCount      = stats?.icons_count      ?? 0;
  const ohnePreisCount    = stats?.ohne_preis_count    ?? 0;
  const ohneBildCount     = stats?.ohne_bild_count     ?? 0;
  const unbearbeitetCount = stats?.unbearbeitet_count  ?? 0;
  const avgCompleteness   = stats?.avg_completeness    ?? 0;
  const completePercent   = stats?.complete_percent    ?? 0;
  const needsAttentionCount = stats?.needs_attention_count ?? 0;

  // Farbschwellen identisch zu src/lib/completeness.ts
  const avgColor: "red" | "yellow" | "green" =
    avgCompleteness < 50 ? "red" : avgCompleteness <= 80 ? "yellow" : "green";

  const statCards: StatProps[] = [
    { label: "Bereiche",   value: bereicheCount,   icon: LayoutGrid, href: "/bereiche",   tone: "primary" },
    { label: "Kategorien", value: kategorienCount, icon: Layers,     href: "/kategorien", tone: "neutral" },
    { label: "Produkte",   value: produkteCount,   icon: Package,    href: "/produkte",   tone: "accent"  },
    { label: "Preise",     value: preiseCount,     icon: TrendingUp, href: "/produkte",   tone: "neutral" },
  ];

  const quickActions: QuickProps[] = [
    { href: "/produkte/neu",           icon: Package,         title: "Neues Produkt",       desc: "Artikel mit technischen Daten anlegen." },
    { href: "/bereiche/neu",           icon: LayoutGrid,      title: "Neuer Bereich",       desc: "Einen weiteren Hauptbereich anlegen." },
    { href: "/icons/neu",              icon: Sparkles,        title: "Neues Icon",          desc: "Icon für Kategorien / Produkte hinzufügen." },
    { href: "/datenblatt-vorlagen",    icon: LayoutTemplate,  title: "Datenblatt-Vorlage",  desc: "Layouts mit Slots verwalten." },
    { href: "/export/katalog",         icon: FileDown,        title: "Katalog exportieren", desc: "Gesamtkatalog als PDF generieren." },
    { href: "/einstellungen",          icon: Settings,        title: "Einstellungen",       desc: "Filialen, Logos, Parameter." },
  ];

  return (
    <AppShell>
      <PageHeader
        eyebrow="Dashboard"
        title="Willkommen im Lichtstudio"
        subtitle="Interne Produktverwaltung von LICHT.ENGROS / Eisenkeil"
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {statCards.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Aufgaben-Widget */}
      <AufgabenWidget
        ohnePreis={ohnePreisCount}
        ohneBild={ohneBildCount}
        unbearbeitet={unbearbeitetCount}
      />

      {/* Vollstaendigkeit Widget */}
      <Card className="mb-8 border-2">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Produktvollstaendigkeit</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 items-center">
            <div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold">{avgCompleteness}%</span>
                <span className="text-sm text-muted-foreground">Durchschnitt</span>
              </div>
              <Progress
                value={avgCompleteness}
                className="h-3 bg-muted"
                indicatorClassName={completenessBarClass(avgColor)}
              />
              <p className="text-sm text-muted-foreground mt-2">
                {completePercent}% der Produkte sind vollstaendig (&gt;80%)
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {needsAttentionCount > 0 ? (
                <Link
                  href="/produkte?vollstaendigkeit=unvollstaendig"
                  className="flex items-center justify-between rounded-lg border bg-background p-3 hover:border-primary/50 transition-colors group"
                >
                  <div>
                    <p className="text-2xl font-bold text-amber-600">{needsAttentionCount}</p>
                    <p className="text-xs text-muted-foreground">Produkte brauchen Aufmerksamkeit</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </Link>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm text-emerald-700 font-medium">Alle Produkte sind vollstaendig gepflegt.</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">Schnellzugriff</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((a) => <QuickCard key={a.href} {...a} />)}
      </div>

      <div className="mt-8 p-4 rounded-xl border bg-background flex items-center justify-between">
        <div className="text-sm">
          <span className="text-muted-foreground">Icon-Sammlung:</span>{" "}
          <span className="font-semibold">{iconsCount} Icons</span> verfügbar
        </div>
        <Link href="/icons" className="text-sm text-primary hover:underline font-medium flex items-center gap-1">
          Icons verwalten <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </AppShell>
  );
}

type StatProps = { label: string; value: number; icon: any; href: string; tone: "primary" | "accent" | "neutral" };
function StatCard({ label, value, icon: Icon, href, tone }: StatProps) {
  const tones = {
    primary: "bg-primary text-primary-foreground",
    accent:  "bg-accent text-accent-foreground",
    neutral: "bg-muted text-foreground",
  } as const;
  return (
    <Link href={href}>
      <Card className="card-hover cursor-pointer border-2">
        <CardContent className="flex items-center gap-4 p-5">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-3xl font-bold leading-none">{value}</p>
            <p className="text-sm text-muted-foreground mt-1">{label}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}

type QuickProps = { href: string; icon: any; title: string; desc: string };
function QuickCard({ href, icon: Icon, title, desc }: QuickProps) {
  return (
    <Link href={href}>
      <Card className="card-hover h-full cursor-pointer group">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold group-hover:text-primary transition-colors">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{desc}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
        </CardContent>
      </Card>
    </Link>
  );
}

type AufgabenProps = { ohnePreis: number; ohneBild: number; unbearbeitet: number };
function AufgabenWidget({ ohnePreis, ohneBild, unbearbeitet }: AufgabenProps) {
  const total = ohnePreis + ohneBild + unbearbeitet;
  const allDone = total === 0;

  return (
    <Card className={`mb-8 border-2 ${allDone ? "border-emerald-200 bg-emerald-50/50" : "border-amber-200 bg-amber-50/50"}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          {allDone
            ? <CheckCircle className="h-5 w-5 text-emerald-600" />
            : <AlertTriangle className="h-5 w-5 text-amber-600" />}
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Aufgaben</h2>
        </div>

        {allDone ? (
          <p className="text-emerald-700 font-medium">Alles erledigt — alle Produkte sind vollstaendig gepflegt.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-3">
            {ohnePreis > 0 && (
              <Link
                href="/produkte?status=unbearbeitet"
                className="flex items-center justify-between rounded-lg border bg-background p-3 hover:border-primary/50 transition-colors group"
              >
                <div>
                  <p className="text-2xl font-bold text-amber-600">{ohnePreis}</p>
                  <p className="text-xs text-muted-foreground">Produkte ohne Preis</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </Link>
            )}
            {ohneBild > 0 && (
              <Link
                href="/produkte?status=unbearbeitet"
                className="flex items-center justify-between rounded-lg border bg-background p-3 hover:border-primary/50 transition-colors group"
              >
                <div>
                  <p className="text-2xl font-bold text-amber-600">{ohneBild}</p>
                  <p className="text-xs text-muted-foreground">Produkte ohne Hauptbild</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </Link>
            )}
            {unbearbeitet > 0 && (
              <Link
                href="/produkte?status=unbearbeitet"
                className="flex items-center justify-between rounded-lg border bg-background p-3 hover:border-primary/50 transition-colors group"
              >
                <div>
                  <p className="text-2xl font-bold text-amber-600">{unbearbeitet}</p>
                  <p className="text-xs text-muted-foreground">Produkte unbearbeitet</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
