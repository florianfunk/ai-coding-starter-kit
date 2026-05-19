import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/buchungen", label: "Buchungen" },
  { href: "/pruefliste", label: "Prüfliste" },
  { href: "/abgleich", label: "Beleg-Abgleich" },
  { href: "/belege", label: "Belege" },
  { href: "/ust-voranmeldung", label: "USt-Voranmeldung" },
  { href: "/euer", label: "EÜR" },
  { href: "/einkommensteuer", label: "Einkommensteuer" },
  { href: "/export", label: "Export" },
];

const SETTINGS = [
  { href: "/einstellungen/firma", label: "Firma & Steuerprofil" },
  { href: "/einstellungen/kontenrahmen", label: "Kontenrahmen" },
  { href: "/einstellungen/konten", label: "Bankkonten" },
  { href: "/einstellungen/paperless", label: "Paperless" },
  { href: "/einstellungen/regeln", label: "Lernregeln" },
  { href: "/einstellungen/admin", label: "Admin" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r bg-muted/20 p-4 md:block">
        <div className="mb-6 px-2 text-lg font-semibold">STEUERAGENT</div>
        <nav className="space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
          <div className="pt-4 text-xs font-medium uppercase text-muted-foreground px-3">
            Einstellungen
          </div>
          {SETTINGS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-sm hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <form action="/auth/signout" method="post" className="mt-6">
          <Button variant="outline" size="sm" className="w-full">
            Abmelden
          </Button>
        </form>
      </aside>
      <main className="flex-1 overflow-x-hidden p-6 md:p-8">{children}</main>
    </div>
  );
}
