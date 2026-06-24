import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-Role-Client — NUR serverseitig (z. B. Cron ohne Nutzer-Session).
 *
 * Umgeht RLS. Niemals an den Browser geben. Wird ausschließlich in
 * server-only Kontexten (Route Handler/Cron) verwendet, wo owner-Scoping
 * explizit im Code erfolgt.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Admin-Client benötigt NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
