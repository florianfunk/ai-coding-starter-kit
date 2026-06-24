import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-Role-Client — NUR serverseitig (z. B. Cron ohne Nutzer-Session).
 *
 * Umgeht RLS. Niemals an den Browser geben. Wird ausschließlich in
 * server-only Kontexten (Route Handler/Cron) verwendet, wo owner-Scoping
 * explizit im Code erfolgt.
 */
export function createAdminClient(): SupabaseClient {
  // Harte Server-Schranke (QA-W1): Dieser Client umgeht RLS und hält den
  // Service-Role-Key. Läuft er je in einer Browser-Umgebung, werfen wir sofort,
  // statt den Key zu riskieren. (Das `server-only`-npm-Paket ist im Projekt
  // nicht installiert; dieser Laufzeit-Guard ist der dependency-freie Ersatz.)
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() darf NUR serverseitig aufgerufen werden (Service-Role-Key).",
    );
  }

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
