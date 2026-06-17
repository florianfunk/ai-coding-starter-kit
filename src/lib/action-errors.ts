// Maps Postgres / PostgREST errors to stable, UI-translatable error codes.
export interface DbError {
  code?: string;
  message?: string;
}

export function mapActionError(err: DbError | null | undefined): string {
  if (!err) return "failed";
  if (err.code === "23505") return "already_invited"; // unique_violation
  if (err.message?.includes("org_must_keep_one_admin")) return "last_admin";
  return err.message ?? "failed";
}
