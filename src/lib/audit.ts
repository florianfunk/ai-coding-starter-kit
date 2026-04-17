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

export async function logAudit(
  supabase: { from: (table: string) => any },
  params: AuditParams,
) {
  try {
    await supabase.from("audit_log").insert({
      user_email: params.userEmail ?? null,
      table_name: params.tableName,
      record_id: params.recordId,
      action: params.action,
      changes: params.changes ?? null,
      record_label: params.recordLabel ?? null,
    });
  } catch {
    // Audit logging should never break the main operation
    console.error("[audit] Failed to write audit log entry");
  }
}
