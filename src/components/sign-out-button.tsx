"use client";

import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const t = useTranslations("Header");
  const locale = useLocale();

  async function logout() {
    if (hasSupabaseEnv) {
      try {
        await createClient().auth.signOut();
      } catch {
        /* ignore — redirect to login regardless */
      }
    }
    window.location.href = `/${locale}/login`;
  }

  return (
    <Button variant="outline" onClick={logout}>
      <LogOut className="mr-2 h-4 w-4" />
      {t("logout")}
    </Button>
  );
}
