import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Default server client — uses the Anon key, so all queries are subject to RLS.
// Use this for any code that runs on behalf of the logged-in user (Server
// Components, Server Actions, API routes that should respect the user session).
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot set cookies.
          }
        },
      },
    },
  );
}

// Privileged client that bypasses RLS — only for code paths that need it
// (e.g. serving binary files from buckets after a user-auth check, running
// background jobs, or admin-only utilities). Never expose responses from this
// client without first verifying the caller is authorized.
export async function createServiceRoleClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    },
  );
}
