// PROJ-13: Adminbereich (Server Component).
// Lädt KI-Status (ohne Klartext-Key) + Benutzerinfo serverseitig
// (RLS-geschützt) und übergibt sie an die Client-Tabs.

import { requireUser } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { PageHeader, PageShell } from "@/components/layout/page-shell";

export const metadata = {
  title: "Admin · STEUERAGENT",
};

const DEFAULT_MODEL = "anthropic/claude-haiku-4-5";

export interface KiStatus {
  ai_model: string;
  ai_key_gesetzt: boolean;
}

export interface BenutzerInfo {
  email: string;
  last_sign_in_at: string | null;
}

export default async function AdminPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("app_einstellung")
    .select("ai_key_cipher, ai_model")
    .eq("owner_id", user.id)
    .maybeSingle();

  const row = data as {
    ai_key_cipher: string | null;
    ai_model: string | null;
  } | null;

  const kiStatus: KiStatus = {
    ai_model: row?.ai_model?.trim() || DEFAULT_MODEL,
    ai_key_gesetzt: (row?.ai_key_cipher ?? "").trim().length > 0,
  };

  const benutzer: BenutzerInfo = {
    email: user.email ?? "(keine E-Mail)",
    last_sign_in_at: user.last_sign_in_at ?? null,
  };

  return (
    <PageShell className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Setup"
        titel="Admin"
        beschreibung="Systemkonfiguration: KI-Zugang, eigene Zugangsdaten, System-Status und Daten-Wartung. Secrets werden verschlüsselt gespeichert und nie im Klartext angezeigt."
      />

      <AdminTabs initialKi={kiStatus} benutzer={benutzer} />
    </PageShell>
  );
}
