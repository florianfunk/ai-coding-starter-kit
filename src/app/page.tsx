import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  LayoutGrid, Layers, Package, TrendingUp,
  FileDown, Settings, Sparkles, LayoutTemplate, ArrowRight,
  CheckCircle, AlertTriangle,
} from "lucide-react";
import { calculateCompleteness, completenessBarClass } from "@/lib/completeness";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const [
    { count: bCount }, { count: kCount }, { count: pCount }, { count: prCount }, { count: iCount },
    { count: ohneBildCount }, { count: unbearbeitetCount },
    { data: produkteMitPreis },
  ] = await Promise.all([
    supabase.from("bereiche").select("*", { count: "exact", head: true }),
    supabase.from("kategorien").select("*", { count: "exact", head: true }),
    supabase.from("produkte").select("*", { count: "exact", head: true }),
    supabase.from("preise").select("*", { count: "exact", head: true }),
    supabase.from("icons").select("*", { count: "exact", head: true }),
    supabase.from("produkte").select("*", { count: "exact", head: true }).is("hauptbild_path", null),
    supabase.from("produkte").select("*", { count: "exact", head: true }).eq("artikel_bearbeitet", false),
    supabase.from("preise").select("produkt_id").limit(5000),
  ]);

  const produkteWithPriceIds = new Set((produkteMitPreis ?? []).map((r) => r.produkt_id));
  const ohnePreisCount = (pCount ?? 0) - produkteWithPriceIds.size;

  // Fetch data for completeness widget
  const [{ data: alleProdukte }, { data: alleIcons }, { data: alleGalerie }] = await Promise.all([
    supabase.from("produkte").select("id,artikelnummer,name,kategorie_id,hauptbild_path,datenblatt_titel,datenblatt_text,datenblatt_template_id,leistung_w,lichtstrom_lm,farbtemperatur_k,schutzart_ip,masse_text,laenge_mm,breite_mm,hoehe_mm").limit(5000),
    supabase.from("produkt_icons").select("produkt_id").limit(10000),
    supabase.from("produkt_bilder").select("produkt_id").limit(10000),
  ]);

  const iconCountMap: Record<string, number> = {};
  for (const r of alleIcons ?? []) {
    iconCountMap[r.produkt_id] = (iconCountMap[r.produkt_id] ?? 0) + 1;
  }
  const galerieCountMap: Record<string, number> = {};
  for (const r of alleGalerie ?? []) {
    galerieCountMap[r.produkt_id] = (galerieCountMap[r.produkt_id] ?? 0) + 1;
  }

  let completenessSum = 0;
  let completeCount = 0;
  let needsAttentionCount = 0;
  const totalProdukte = (alleProdukte ?? []).length;

  for (const p of alleProdukte ?? []) {
    const result = calculateCompleteness(p, {
      hasActivePrice: produkteWithPriceIds.has(p.id),
      iconCount: iconCountMap[p.id] ?? 0,
      galerieCount: galerieCountMap[p.id] ?? 0,
    });
    completenessSum += result.percent;
    if (result.percent > 80) completeCount++;
    if (result.percent <= 80) needsAttentionCount++;
  }

  const avgCompleteness = totalProdukte > 0 ? Math.round(completenessSum / totalProdukte) : 0;
  const completePercent = totalProdukte > 0 ? Math.round((completeCount / totalProdukte) * 100) : 0;
  const avgColor = avgCompleteness < 50 ? "red" as const : avgCompleteness <= 80 ? "yellow" as const : "green" as const;

  const stats: StatProps[] = [
    { label: "Bereiche",   value: bCount ?? 0,  icon: LayoutGrid, href: "/bereiche",   tone: "primary" },
    { label: "Kategorien", value: kCount ?? 0,  icon: Layers,     href: "/kategorien", tone: "neutral" },
    { label: "Produkte",   value: pCount ?? 0,  icon: Package,    href: "/produkte",   tone: "accent"  },
    { label: "Preise",     value: prCount ?? 0, icon: TrendingUp, href: "/produkte",   tone: "neutral" },
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
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Aufgaben-Widget */}
      <AufgabenWidget
        ohnePreis={ohnePreisCount > 0 ? ohnePreisCount : 0}
        ohneBild={ohneBildCount ?? 0}
        unbearbeitet={unbearbeitetCount ?? 0}
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
          <span className="font-semibold">{iCount ?? 0} Icons</span> verfügbar
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
