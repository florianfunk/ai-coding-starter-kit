// PROJ-13 — Live-Liste der verfügbaren Claude-Modelle vom AI Gateway.
// GET: nutzt den aufgelösten Key (DB vor Env). Ohne Key oder bei Fehler
// liefert es die kuratierte Fallback-Liste (kein harter Fehler — das
// Dropdown bleibt immer benutzbar).
// Auth Pflicht (getApiUser). Keine Secrets im Response.

import { NextResponse } from "next/server";
import { createGateway } from "ai";
import { getApiUser } from "@/lib/auth/guard";
import { ladeAiKey } from "@/lib/admin/ai-key";
import { CLAUDE_MODELLE } from "@/lib/admin/claude-modelle";

interface ModellDto {
  slug: string;
  label: string;
}

const FALLBACK: ModellDto[] = CLAUDE_MODELLE.map((m) => ({
  slug: m.slug,
  label: m.label,
}));

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { key } = await ladeAiKey();
  if (!key) {
    return NextResponse.json({ modelle: FALLBACK, quelle: "kuratiert" });
  }

  try {
    const gateway = createGateway({ apiKey: key });
    const verfuegbar = await gateway.getAvailableModels();
    const claude = verfuegbar.models
      .filter((m) => m.id.startsWith("anthropic/"))
      .map<ModellDto>((m) => ({ slug: m.id, label: m.name ?? m.id }))
      .sort((a, b) => a.label.localeCompare(b.label));

    if (claude.length === 0) {
      return NextResponse.json({ modelle: FALLBACK, quelle: "kuratiert" });
    }
    return NextResponse.json({ modelle: claude, quelle: "gateway" });
  } catch {
    // Gateway nicht erreichbar / Key ungültig → kuratierte Liste, kein Fehler.
    return NextResponse.json({ modelle: FALLBACK, quelle: "kuratiert" });
  }
}
