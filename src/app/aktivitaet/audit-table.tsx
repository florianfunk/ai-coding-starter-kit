"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

type AuditEntry = {
  id: string;
  created_at: string;
  user_email: string | null;
  table_name: string;
  record_id: string;
  action: "create" | "update" | "delete";
  changes: Record<string, { old: unknown; new: unknown }> | null;
  record_label: string | null;
};

const ACTION_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  create: { label: "Erstellt", variant: "default" },
  update: { label: "Bearbeitet", variant: "secondary" },
  delete: { label: "Geloescht", variant: "destructive" },
};

const TABLE_LABELS: Record<string, string> = {
  bereiche: "Bereiche",
  kategorien: "Kategorien",
  produkte: "Produkte",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ChangesDetail({ changes }: { changes: Record<string, { old: unknown; new: unknown }> }) {
  return (
    <div className="text-xs space-y-1 py-2">
      {Object.entries(changes).map(([field, vals]) => (
        <div key={field} className="flex gap-2">
          <span className="font-medium text-muted-foreground min-w-[120px]">{field}:</span>
          <span className="text-destructive line-through">{String(vals.old ?? "—")}</span>
          <span className="text-primary">{String(vals.new ?? "—")}</span>
        </div>
      ))}
    </div>
  );
}

export function AuditTable({ entries, currentFilter }: { entries: AuditEntry[]; currentFilter: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  function toggleRow(id: string) {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function onFilterChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "alle") {
      params.delete("tabelle");
    } else {
      params.set("tabelle", value);
    }
    router.push(`/aktivitaet?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter:</span>
        <Select value={currentFilter} onValueChange={onFilterChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Tabellen</SelectItem>
            <SelectItem value="bereiche">Bereiche</SelectItem>
            <SelectItem value="kategorien">Kategorien</SelectItem>
            <SelectItem value="produkte">Produkte</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          Noch keine Aenderungen protokolliert.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Zeitpunkt</TableHead>
                <TableHead className="w-[180px]">Nutzer</TableHead>
                <TableHead className="w-[100px]">Aktion</TableHead>
                <TableHead className="w-[120px]">Tabelle</TableHead>
                <TableHead>Element</TableHead>
                <TableHead className="w-[60px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const badge = ACTION_BADGE[entry.action] ?? ACTION_BADGE.update;
                const hasChanges = entry.changes && Object.keys(entry.changes).length > 0;
                const isOpen = openRows.has(entry.id);

                return (
                  <Collapsible key={entry.id} open={isOpen} onOpenChange={() => toggleRow(entry.id)} asChild>
                    <>
                      <TableRow className={hasChanges ? "cursor-pointer hover:bg-muted/50" : ""}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTime(entry.created_at)}
                        </TableCell>
                        <TableCell className="text-sm truncate max-w-[180px]">
                          {entry.user_email ?? "System"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {TABLE_LABELS[entry.table_name] ?? entry.table_name}
                        </TableCell>
                        <TableCell className="text-sm font-mono truncate max-w-[200px]">
                          {entry.record_label ?? entry.record_id}
                        </TableCell>
                        <TableCell>
                          {hasChanges && (
                            <CollapsibleTrigger asChild>
                              <button className="p-1 rounded hover:bg-muted" aria-label="Details anzeigen">
                                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                              </button>
                            </CollapsibleTrigger>
                          )}
                        </TableCell>
                      </TableRow>
                      {hasChanges && (
                        <CollapsibleContent asChild>
                          <tr>
                            <td colSpan={6} className="bg-muted/30 px-6">
                              <ChangesDetail changes={entry.changes!} />
                            </td>
                          </tr>
                        </CollapsibleContent>
                      )}
                    </>
                  </Collapsible>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
