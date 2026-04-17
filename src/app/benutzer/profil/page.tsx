import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mein Profil - Lichtstudio" };

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr));
}

export default async function ProfilPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Konto"
        title="Mein Profil"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Benutzer", href: "/benutzer" },
          { label: "Profil" },
        ]}
      />

      <div className="grid gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Kontoinformationen</CardTitle>
            <CardDescription>Deine persoenlichen Daten</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">E-Mail-Adresse</p>
              <p className="text-sm font-semibold">{user.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Mitglied seit</p>
              <p className="text-sm font-semibold">{formatDate(user.created_at)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Passwort aendern</CardTitle>
            <CardDescription>
              Waehle ein sicheres Passwort mit mindestens 8 Zeichen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
