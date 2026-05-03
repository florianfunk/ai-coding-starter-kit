/**
 * Append-only audit log helper.
 * Call from server actions after successful DB mutations.
 */

type AuditParams = {
  userEmail?: string;
  tableName: string;
  recordId: string;
  action: "create" | "update" | "delete";
  changes?: Record<string, { old: unknown; new: unknown }>;
  recordLabel?: string;
};

function toRow(p: AuditParams) {
  return {
    user_email: p.userEmail ?? null,
    table_name: p.tableName,
    record_id: p.recordId,
    action: p.action,
    changes: p.changes ?? null,
    record_label: p.recordLabel ?? null,
  };
}

export async function logAudit(
  supabase: { from: (table: string) => any },
  params: AuditParams,
) {
  try {
    await supabase.from("audit_log").insert(toRow(params));
  } catch {
    console.error("[audit] Failed to write audit log entry");
  }
}

/**
 * Batch variant — one INSERT for many records. Use this in bulk operations
 * to avoid N round-trips that can blow the function timeout.
 */
export async function logAuditMany(
  supabase: { from: (table: string) => any },
  entries: AuditParams[],
) {
  if (entries.length === 0) return;
  try {
    await supabase.from("audit_log").insert(entries.map(toRow));
  } catch {
    console.error("[audit] Failed to write batched audit log entries");
  }
}
