import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive mb-6">
          {loadError}
        </div>
      )}

      {users.length === 0 && !loadError ? (
        <EmptyState
          icon={Users}
          title="Keine Benutzer vorhanden"
          description="Erstellen Sie den ersten Benutzer, um die Anwendung nutzen zu koennen."
        />
      ) : users.length > 0 ? (
        <>
          {users.length >= 10 && (
            <div className="rounded-lg border border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-sm text-yellow-800 dark:text-yellow-200 mb-4">
              Maximale Anzahl von 10 Benutzern erreicht.
            </div>
          )}
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-Mail</TableHead>
                  <TableHead className="hidden sm:table-cell">Erstellt am</TableHead>
                  <TableHead className="hidden md:table-cell">Letzter Login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Aktionen</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    className={user.banned ? "opacity-50" : ""}
                  >
                    <TableCell className="font-medium">
                      {user.email}
                      {currentUser?.id === user.id && (
                        <span className="ml-2 text-xs text-muted-foreground">(Du)</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {formatDate(user.created_at)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {formatDate(user.last_sign_in_at)}
                    </TableCell>
                    <TableCell>
                      {user.banned ? (
                        <Badge variant="destructive">Deaktiviert</Badge>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100">
                          Aktiv
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <UserActionsCell
                        user={user}
                        currentUserId={currentUser?.id ?? ""}
                      />
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
