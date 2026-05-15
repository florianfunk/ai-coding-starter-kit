import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Erlaubte Account-E-Mail (Single-Tenant). Leer = jeder eingeloggte Nutzer. */
const ALLOWED_EMAIL = process.env.STEUERAGENT_ALLOWED_EMAIL?.toLowerCase();

/**
 * Erzwingt eine gültige Session in Server Components.
 * Bei fehlender/unerlaubter Session: Redirect auf /login.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (ALLOWED_EMAIL && user.email?.toLowerCase() !== ALLOWED_EMAIL) {
    redirect("/login?error=not-allowed");
  }
  return user;
}

/** Wie requireUser, aber für Route Handlers: liefert user oder null. */
export async function getApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (ALLOWED_EMAIL && user.email?.toLowerCase() !== ALLOWED_EMAIL) return null;
  return user;
}
