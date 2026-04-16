import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import {
  LayoutGrid, Layers, Package, TrendingUp,
  FileDown, Settings, Sparkles, LayoutTemplate, ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const [{ count: bCount }, { count: kCount }, { count: pCount }, { count: prCount }, { count: iCount }] = await Promise.all([
    supabase.from("bereiche").select("*", { count: "exact", head: true }),
    supabase.from("kategorien").select("*", { count: "exact", head: true }),
    supabase.from("produkte").select("*", { count: "exact", head: true }),
    supabase.from("preise").select("*", { count: "exact", head: true }),
    supabase.from("icons").select("*", { count: "exact", head: true }),
  ]);

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
