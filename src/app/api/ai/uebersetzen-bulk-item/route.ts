/**
 * PROJ-46 — POST /api/ai/uebersetzen-bulk-item
 *
 * Übersetzt **und schreibt** alle datenblatt-relevanten Felder eines einzelnen
 * Produkts ins Italienische. Verwendet von Bulk-Wizard und Auto-Trigger nach
 * `updateProdukt`. Direkt-Schreiben in die DB (kein User-Review).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  uebersetzeProdukt,
  UebersetzeProduktError,
} from "@/lib/ai/uebersetzen-produkt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  produktId: z.string().uuid(),
  zielsprache: z.literal("it"),
  /** Wenn true, werden Felder mit bereits gefülltem `*_it` übersprungen. */
  nurLeere: z.boolean().optional().default(false),
  /** Optional: nur diese DE-Schlüssel übersetzen. Default: alle. */
  felder: z.array(z.string()).optional(),
});

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const LIMIT_PER_HOUR = 500;
const HOUR_MS = 60 * 60 * 1000;

function checkRateLimit(key: string): { ok: boolean } {
  const now = Date.now();
  const entry = rateLimit.get(key);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + HOUR_MS });
    return { ok: true };
  }
  if (entry.count >= LIMIT_PER_HOUR) return { ok: false };
  entry.count++;
  return { ok: true };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  if (!checkRateLimit(user.id).ok) {
    return NextResponse.json(
      { error: "Limit erreicht (500 Anfragen / Stunde). Bitte später erneut versuchen." },
      { status: 429 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Eingabe ungültig." },
      { status: 400 },
    );
  }

  try {
    const result = await uebersetzeProdukt(supabase, parsed.data.produktId, {
      nurLeere: parsed.data.nurLeere,
      felder: parsed.data.felder,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof UebersetzeProduktError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unbekannter Fehler." },
      { status: 500 },
    );
  }
}
