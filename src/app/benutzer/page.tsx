import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { listUsers } from "./actions";
import { CreateUserDialog } from "./create-user-dialog";
import { UserActionsCell } from "./user-actions-cell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Benutzerverwaltung - Lichtstudio" };

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export default async function BenutzerPage() {
  const supabase = await createClient();
  const { data: { user: currentUser } } = await supabase.auth.getUser();

  let users: Awaited<ReturnType<typeof listUsers>> = [];
  let loadError: string | null = null;
  try {
    users = await listUsers();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Fehler beim Laden der Benutzer.";
    users = [];
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Verwaltung"
        title="Benutzerverwaltung"
        subtitle={`${users.length} Benutzer`}
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Benutzer" },
        ]}
      >
        <CreateUserDialog />
      </PageHeader>

      {loadError && (
        <div className="mb-6 rounded-[14px] border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {loadError}
        </div>
      )}

      {users.length === 0 && !loadError ? (
        <EmptyState
          icon={Users}
          title="Keine Benutzer vorhanden"
          description="Erstellen Sie den ersten Benutzer, um die Anwendung nutzen zu können."
        />
      ) : users.length > 0 ? (
        <>
          {users.length >= 10 && (
            <div className="mb-4 rounded-[14px] border border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/10 p-3 text-sm text-foreground/80">
              Maximale Anzahl von 10 Benutzern erreicht.
            </div>
          )}
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    E-Mail
                  </TableHead>
                  <TableHead className="hidden text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70 sm:table-cell">
                    Erstellt
                  </TableHead>
                  <TableHead className="hidden text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70 md:table-cell">
                    Letzter Login
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
                    Status
                  </TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Aktionen</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className={user.banned ? "opacity-50" : ""}>
                    <TableCell className="pl-5 font-medium">
                      {user.email}
                      {currentUser?.id === user.id && (
                        <span className="ml-2 text-xs text-muted-foreground">(Du)</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden font-mono text-[12px] tabular-nums text-muted-foreground sm:table-cell">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="hidden font-mono text-[12px] tabular-nums text-muted-foreground md:table-cell">
                      {formatDate(user.last_sign_in_at)}
                    </TableCell>
                    <TableCell>
                      {user.banned ? (
                        <span className="pill pill-bad">Deaktiviert</span>
                      ) : (
                        <span className="pill pill-ok">Aktiv</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <UserActionsCell user={user} currentUserId={currentUser?.id ?? ""} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
