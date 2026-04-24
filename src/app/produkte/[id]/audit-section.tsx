import { createClient } from "@/lib/supabase/server";
import { History } from "lucide-react";
import Link from "next/link";

const ACTION_LABEL: Record<string, string> = {
  create: "Erstellt",
  update: "Bearbeitet",
  delete: "Gelöscht",
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
    <section id="section-history" className="glass-card">
      <div className="card-head">
        <div className="card-head-icon"><History /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="card-head-title">Historie</span>
            <span className="font-mono text-[11px] text-white/60">
              {entries.length}
            </span>
          </div>
          <div className="card-head-sub">
            Letzte Änderungen an diesem Produkt
          </div>
        </div>
        <Link
          href="/aktivitaet?tabelle=produkte"
          className="text-[12px] font-medium text-white/80 hover:text-white"
        >
          Alle anzeigen →
        </Link>
      </div>
      <ul className="divide-y divide-border/60">
        {entries.map((entry) => {
          const label = ACTION_LABEL[entry.action] ?? "Aktion";
          const isCreate = entry.action === "create";
          const isDelete = entry.action === "delete";
          const pillClass = isCreate ? "pill-ok" : isDelete ? "pill-bad" : "pill-accent";
          return (
            <li key={entry.id} className="flex items-center gap-3 px-5 py-3 text-[13px]">
              <span className={`pill ${pillClass}`}>{label}</span>
              <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                {formatTime(entry.created_at)}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {entry.user_email ?? "System"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
