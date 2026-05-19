// PROJ-13 — Zentrale Auflösung des AI-Gateway-Keys (NUR serverseitig).
//
// Eine Quelle der Wahrheit für die Key-/Modell-Auflösung:
//   1. app_einstellung des eingeloggten Nutzers (entschlüsselt) — Vorrang
//   2. Fallback auf process.env.AI_GATEWAY_API_KEY
//   3. null, wenn beides leer ist
//
// Robust: wirft NIE. Ohne Session/DB (z. B. Tests, Build) wird sauber auf
// die Env zurückgefallen. Der Klartext-Key wird nie geloggt oder an den
// Client gegeben — diese Funktion ist rein serverseitig.

import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";

/** Standard-Modell, falls weder DB noch Env ein Modell liefern. */
const DEFAULT_MODEL = "anthropic/claude-haiku-4-5";

export interface AiKeyAufloesung {
  /** Klartext-Key oder null, wenn nirgends konfiguriert. */
  key: string | null;
  /** Aufzulösendes Modell (immer gesetzt). */
  model: string;
  /** Woher der Key stammt — null wenn keiner gefunden wurde. */
  quelle: "db" | "env" | null;
}

function envKey(): string | null {
  const k = process.env.AI_GATEWAY_API_KEY?.trim();
  return k && k.length > 0 ? k : null;
}

function envModel(): string {
  const m = process.env.STEUERAGENT_LLM_MODEL?.trim();
  return m && m.length > 0 ? m : DEFAULT_MODEL;
}

interface EinstellungRow {
  ai_key_cipher: string | null;
  ai_model: string | null;
}

/**
 * Löst AI-Key + Modell zentral auf. DB-Key (verschlüsselt) hat Vorrang vor
 * der Env. Wirft niemals — bei fehlender Session/DB greift der Env-Fallback.
 */
export async function ladeAiKey(): Promise<AiKeyAufloesung> {
  let dbKey: string | null = null;
  let dbModel: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data, error } = await supabase
        .from("app_einstellung")
        .select("ai_key_cipher, ai_model")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!error && data) {
        const row = data as EinstellungRow;
        const cipher = row.ai_key_cipher?.trim();
        if (cipher && cipher.length > 0) {
          try {
            const klar = decrypt(cipher).trim();
            if (klar.length > 0) dbKey = klar;
          } catch {
            // Entschlüsselung fehlgeschlagen (z. B. Key-Wechsel):
            // still auf Env-Fallback zurückfallen, nicht werfen.
          }
        }
        const m = row.ai_model?.trim();
        if (m && m.length > 0) dbModel = m;
      }
    }
  } catch {
    // Keine Session / kein Cookie-Kontext / DB nicht erreichbar:
    // sauberer Env-Fallback, kein Throw.
  }

  if (dbKey) {
    return { key: dbKey, model: dbModel ?? envModel(), quelle: "db" };
  }

  const fallbackModel = dbModel ?? envModel();
  const eK = envKey();
  if (eK) {
    return { key: eK, model: fallbackModel, quelle: "env" };
  }

  return { key: null, model: fallbackModel, quelle: null };
}
