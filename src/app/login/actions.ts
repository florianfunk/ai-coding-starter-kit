"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(1, "Passwort erforderlich"),
  next: z.string().optional(),
});

export type AuthState = { error: string | null };

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: "E-Mail oder Passwort ungültig." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: "E-Mail oder Passwort ungültig." };
  }

  redirect(parsed.data.next && parsed.data.next.startsWith("/") ? parsed.data.next : "/");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const resetRequestSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
});

export async function requestPasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: "Ungültige E-Mail-Adresse." };
  }

  const supabase = await createClient();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/reset-password/confirm`,
  });

  // Always return success — never leak whether an email exists.
  return { error: null };
}

const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Mindestens 8 Zeichen"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirm"],
  });

export async function setNewPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    return { error: "Passwort konnte nicht gesetzt werden. Link evtl. abgelaufen." };
  }

  redirect("/");
}
