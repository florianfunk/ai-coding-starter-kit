"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase-Konfiguration fehlt.");
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── List users ──────────────────────────────────────────────

export type UserRow = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  banned: boolean;
};

export async function listUsers(): Promise<UserRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 50 });
  if (error) throw new Error("Benutzer konnten nicht geladen werden.");

  return data.users.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
  }));
}

// ── Create user ─────────────────────────────────────────────

const createUserSchema = z.object({
  email: z.string().email("Ungueltige E-Mail-Adresse"),
  password: z.string().min(8, "Mindestens 8 Zeichen"),
});

export type ActionState = { error: string | null; success?: boolean };

export async function createUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createUserSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  const admin = createAdminClient();

  // Soft limit: warn at 10 users
  const { data: existing } = await admin.auth.admin.listUsers({ perPage: 50 });
  if (existing && existing.users.length >= 10) {
    return { error: "Maximale Anzahl von 10 Benutzern erreicht. Bitte zuerst einen Benutzer entfernen." };
  }

  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });

  if (error) {
    if (error.message?.includes("already been registered")) {
      return { error: "Diese E-Mail-Adresse ist bereits registriert." };
    }
    return { error: `Fehler beim Erstellen: ${error.message}` };
  }

  redirect("/benutzer?toast=success&message=Benutzer%20erfolgreich%20erstellt");
}

// ── Toggle ban ──────────────────────────────────────────────

export async function toggleUserBan(
  userId: string,
  ban: boolean,
): Promise<ActionState> {
  const admin = createAdminClient();

  // If banning: ensure at least 1 active user remains
  if (ban) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 50 });
    const activeCount = (data?.users ?? []).filter(
      (u) => !(u.banned_until && new Date(u.banned_until) > new Date()) && u.id !== userId,
    ).length;
    if (activeCount < 1) {
      return { error: "Es muss mindestens ein aktiver Benutzer vorhanden sein." };
    }
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: ban ? "876000h" : "none",
  });

  if (error) {
    return { error: `Fehler: ${error.message}` };
  }

  revalidatePath("/benutzer");
  return { error: null, success: true };
}

// ── Reset password ──────────────────────────────────────────

export async function resetUserPassword(userId: string): Promise<ActionState> {
  const admin = createAdminClient();
  const { data, error: fetchError } = await admin.auth.admin.getUserById(userId);

  if (fetchError || !data?.user?.email) {
    return { error: "Benutzer nicht gefunden." };
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: data.user.email,
    options: { redirectTo: `${origin}/reset-password/confirm` },
  });

  if (error) {
    return { error: `Fehler beim Senden: ${error.message}` };
  }

  revalidatePath("/benutzer");
  return { error: null, success: true };
}

// ── Change own password ─────────────────────────────────────

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Aktuelles Passwort erforderlich"),
    newPassword: z.string().min(8, "Mindestens 8 Zeichen"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwoerter stimmen nicht ueberein",
    path: ["confirmPassword"],
  });

export async function changeOwnPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  // Verify current password by attempting sign-in
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user?.email) {
    return { error: "Nicht angemeldet." };
  }

  // Use admin client to verify old password by attempting a sign-in
  const admin = createAdminClient();
  const verifyClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { error: signInError } = await verifyClient.auth.signInWithPassword({
    email: userData.user.email,
    password: parsed.data.currentPassword,
  });

  if (signInError) {
    return { error: "Aktuelles Passwort ist falsch." };
  }

  // Update password via admin
  const { error } = await admin.auth.admin.updateUserById(userData.user.id, {
    password: parsed.data.newPassword,
  });

  if (error) {
    return { error: `Fehler beim Aendern: ${error.message}` };
  }

  return { error: null, success: true };
}
