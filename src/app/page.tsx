import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LayoutGrid, Layers, Package, FileDown, Settings, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const [{ count: bCount }, { count: kCount }, { count: pCount }, { count: prCount }] = await Promise.all([
    supabase.from("bereiche").select("*", { count: "exact", head: true }),
    supabase.from("kategorien").select("*", { count: "exact", head: true }),
    supabase.from("produkte").select("*", { count: "exact", head: true }),
    supabase.from("preise").select("*", { count: "exact", head: true }),
  ]);

  const stats = [
    { label: "Bereiche", value: bCount ?? 0, icon: LayoutGrid, href: "/bereiche", color: "bg-blue-500/10 text-blue-600" },
    { label: "Kategorien", value: kCount ?? 0, icon: Layers, href: "/kategorien", color: "bg-emerald-500/10 text-emerald-600" },
    { label: "Produkte", value: pCount ?? 0, icon: Package, href: "/produkte", color: "bg-violet-500/10 text-violet-600" },
    { label: "Preise", value: prCount ?? 0, icon: TrendingUp, href: "/produkte", color: "bg-amber-500/10 text-amber-600" },
  ];

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Willkommen im Lichtstudio</h1>
          <p className="text-muted-foreground mt-1">
            Interne Produktverwaltung von LICHT.ENGROS / Eisenkeil.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Link key={s.label} href={s.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center gap-4 pt-6">
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${s.color}`}>
                    <s.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <QuickAction
            href="/produkte/neu"
            icon={Package}
            title="Neues Produkt"
            desc="Artikel mit technischen Daten anlegen."
          />
          <QuickAction
            href="/export/katalog"
            icon={FileDown}
            title="Katalog exportieren"
            desc="Gesamtkatalog als PDF generieren."
          />
          <QuickAction
            href="/einstellungen"
            icon={Settings}
            title="Einstellungen"
            desc="Filialen, Logos und Katalog-Parameter."
          />
        </div>
      </div>
    </AppShell>
  );
}

function QuickAction({ href, icon: Icon, title, desc }: { href: string; icon: any; title: string; desc: string }) {
  return (
    <Link href={href}>
      <Card className="h-full hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
