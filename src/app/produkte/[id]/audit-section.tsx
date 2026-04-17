import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History } from "lucide-react";
import Link from "next/link";

const ACTION_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  create: { label: "Erstellt", variant: "default" },
  update: { label: "Bearbeitet", variant: "secondary" },
  delete: { label: "Geloescht", variant: "destructive" },
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export async function AuditSection({ produktId }: { produktId: string }) {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("audit_log")
    .select("id, created_at, user_email, action")
    .eq("table_name", "produkte")
    .eq("record_id", produktId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!entries || entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Letzte Aenderungen
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {entries.map((entry) => {
            const badge = ACTION_BADGE[entry.action] ?? ACTION_BADGE.update;
            return (
              <li key={entry.id} className="flex items-center gap-3 text-sm">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatTime(entry.created_at)}
                </span>
                <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                <span className="text-muted-foreground truncate">
                  {entry.user_email ?? "System"}
                </span>
              </li>
            );
          })}
        </ul>
        <Link
          href={`/aktivitaet?tabelle=produkte`}
          className="text-xs text-primary hover:underline mt-3 inline-block"
        >
          Alle Aenderungen anzeigen
        </Link>
      </CardContent>
    </Card>
  );
}
