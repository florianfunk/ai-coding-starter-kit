// PROJ-32 (AC4/AC5): Tests des Orchestrierungs-Laufs mit gemocktem Supabase-
// Client und injiziertem Mail-Versender (KEIN echter Versand, keine echte DB).

import { describe, it, expect, vi } from "vitest";
import { laufFristenErinnerung } from "./cron-runner";
import type { SupabaseClient } from "@supabase/supabase-js";

interface MockData {
  profil: Record<string, unknown> | null;
  abgeschlossene: Array<{ jahr: number; periode: number | null; status: string }>;
  gesendet: Array<{ periode_key: string; stufe: string }>;
  email: string | null;
  /** Optionaler Insert-Fehler (für den W2-Pfad: Log scheitert nach Versand). */
  insertError?: { code?: string; message: string } | null;
  profilError?: { message: string } | null;
  periodenError?: { message: string } | null;
  gesendetError?: { message: string } | null;
}

/**
 * Baut einen minimalen Supabase-Mock, der die im Runner genutzten Query-Ketten
 * bedient: from(...).select(...).limit(...).maybeSingle() (Profil),
 * from(...).select().eq().eq().eq().limit() (Perioden),
 * from(...).select().eq().limit() (gesendet), .insert() und auth.admin.
 */
function mockSupabase(data: MockData) {
  const inserts: Array<Record<string, unknown>> = [];

  function tableQuery(table: string) {
    // Terminale Promise-Auflösung je nach Tabelle.
    const result = () => {
      if (table === "steuerperiode") {
        return { data: data.abgeschlossene, error: data.periodenError ?? null };
      }
      if (table === "fristen_erinnerung") {
        return { data: data.gesendet, error: data.gesendetError ?? null };
      }
      return { data: null, error: null };
    };

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({
        data: data.profil,
        error: data.profilError ?? null,
      }),
      // Perioden/gesendet enden mit .limit() → thenable machen:
      then: (resolve: (v: unknown) => void) => resolve(result()),
      insert: (row: Record<string, unknown>) => {
        inserts.push(row);
        return Promise.resolve({ data: null, error: data.insertError ?? null });
      },
    };
    return chain;
  }

  const client = {
    from: (table: string) => tableQuery(table),
    auth: {
      admin: {
        getUserById: async () => ({
          data: { user: data.email ? { email: data.email } : null },
          error: null,
        }),
      },
    },
    __inserts: inserts,
  } as unknown as SupabaseClient & { __inserts: typeof inserts };

  return client;
}

const baseProfil = {
  owner_id: "owner-1",
  ust_va_rhythmus: "monatlich",
  dauerfristverlaengerung: false,
  fristen_mail_aktiv: true,
};

/**
 * Alle USt-VA-Perioden VOR Februar 2026 als abgeschlossen markieren, damit
 * `naechsteUstFrist` nicht eine ältere überfällige Periode wählt, sondern die
 * nächste offene (Februar 2026, Frist 2026-03-10). Deckt Vorjahr (2025, alle
 * 12 Monate) + Januar 2026 ab.
 */
function abgeschlossenBisJan2026() {
  const out: Array<{ jahr: number; periode: number | null; status: string }> =
    [];
  for (let m = 1; m <= 12; m++) {
    out.push({ jahr: 2025, periode: m, status: "abgeschlossen" });
  }
  out.push({ jahr: 2026, periode: 1, status: "abgeschlossen" });
  return out;
}

describe("laufFristenErinnerung", () => {
  it("meldet Datenbankfehler beim Laden des Profils statt 'kein Profil'", async () => {
    const supabase = mockSupabase({
      profil: null,
      profilError: { message: "connection reset" },
      abgeschlossene: [],
      gesendet: [],
      email: "x@y.de",
    });

    await expect(
      laufFristenErinnerung({
        supabase,
        heute: "2026-03-05",
        appUrl: "https://app.de",
      }),
    ).rejects.toThrow("Firmenprofil");
  });

  it("meldet Datenbankfehler beim Laden der Steuerperioden", async () => {
    const supabase = mockSupabase({
      profil: baseProfil,
      periodenError: { message: "timeout" },
      abgeschlossene: [],
      gesendet: [],
      email: "x@y.de",
    });

    await expect(
      laufFristenErinnerung({
        supabase,
        heute: "2026-03-05",
        appUrl: "https://app.de",
      }),
    ).rejects.toThrow("Steuerperioden");
  });

  it("meldet Datenbankfehler beim Laden des Versandprotokolls", async () => {
    const supabase = mockSupabase({
      profil: baseProfil,
      gesendetError: { message: "timeout" },
      abgeschlossene: [],
      gesendet: [],
      email: "x@y.de",
    });

    await expect(
      laufFristenErinnerung({
        supabase,
        heute: "2026-03-05",
        appUrl: "https://app.de",
      }),
    ).rejects.toThrow("Versandprotokoll");
  });

  it("kein Profil → status kein_profil, kein Versand", async () => {
    const supabase = mockSupabase({
      profil: null,
      abgeschlossene: [],
      gesendet: [],
      email: "x@y.de",
    });
    const versender = vi.fn();
    const res = await laufFristenErinnerung({
      supabase,
      heute: "2026-03-05",
      appUrl: "https://app.de",
      versender,
    });
    expect(res.status).toBe("kein_profil");
    expect(versender).not.toHaveBeenCalled();
  });

  it("Opt-out → kein Versand", async () => {
    const supabase = mockSupabase({
      profil: { ...baseProfil, fristen_mail_aktiv: false },
      abgeschlossene: [],
      gesendet: [],
      email: "x@y.de",
    });
    const versender = vi.fn();
    const res = await laufFristenErinnerung({
      supabase,
      heute: "2026-03-05",
      appUrl: "https://app.de",
      versender,
    });
    expect(res.status).toBe("opt_out");
    expect(versender).not.toHaveBeenCalled();
  });

  it("keine Mailadresse → kein Versand", async () => {
    const supabase = mockSupabase({
      profil: baseProfil,
      abgeschlossene: [],
      gesendet: [],
      email: null,
    });
    const versender = vi.fn();
    const res = await laufFristenErinnerung({
      supabase,
      heute: "2026-03-05",
      appUrl: "https://app.de",
      versender,
    });
    expect(res.status).toBe("keine_mailadresse");
    expect(versender).not.toHaveBeenCalled();
  });

  it("fällige Frist (gelb) → versendet + Log-Insert", async () => {
    // Februar 2026, monatlich, Frist = 2026-03-10. heute = 2026-02-28 → 10 Tage
    // → gelbe Ampel → Stufe 14_tage fällig.
    const supabase = mockSupabase({
      profil: baseProfil,
      abgeschlossene: abgeschlossenBisJan2026(),
      gesendet: [],
      email: "inhaber@firma.de",
    });
    const versender = vi
      .fn()
      .mockResolvedValue({ gesendet: true, grund: "ok" });
    const res = await laufFristenErinnerung({
      supabase,
      heute: "2026-02-28",
      appUrl: "https://app.de",
      versender,
    });
    expect(res.status).toBe("versendet");
    expect(res.gesendet).toBe(true);
    expect(versender).toHaveBeenCalledOnce();
    const inserts = (supabase as unknown as { __inserts: unknown[] }).__inserts;
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      owner_id: "owner-1",
      stufe: "14_tage",
    });
  });

  it("W2: Log-Insert scheitert nach Versand → warnung gesetzt", async () => {
    // Transienter DB-Fehler (kein 23505) beim Idempotenz-Log nach erfolgreichem
    // Versand → der Lauf meldet eine warnung (Doppelversand-Risiko sichtbar).
    const supabase = mockSupabase({
      profil: baseProfil,
      abgeschlossene: abgeschlossenBisJan2026(),
      gesendet: [],
      email: "inhaber@firma.de",
      insertError: { code: "08006", message: "connection reset" },
    });
    const versender = vi
      .fn()
      .mockResolvedValue({ gesendet: true, grund: "ok" });
    const res = await laufFristenErinnerung({
      supabase,
      heute: "2026-02-28",
      appUrl: "https://app.de",
      versender,
    });
    expect(res.status).toBe("versendet");
    expect(res.gesendet).toBe(true);
    expect(res.warnung).toContain("Doppelversand");
  });

  it("W2: Duplikat-Verletzung (23505) ist KEIN Warnfall", async () => {
    // Greift die unique-Constraint, ist alles korrekt — keine warnung.
    const supabase = mockSupabase({
      profil: baseProfil,
      abgeschlossene: abgeschlossenBisJan2026(),
      gesendet: [],
      email: "inhaber@firma.de",
      insertError: { code: "23505", message: "duplicate key" },
    });
    const versender = vi
      .fn()
      .mockResolvedValue({ gesendet: true, grund: "ok" });
    const res = await laufFristenErinnerung({
      supabase,
      heute: "2026-02-28",
      appUrl: "https://app.de",
      versender,
    });
    expect(res.status).toBe("versendet");
    expect(res.warnung).toBeUndefined();
  });

  it("idempotent: bereits gesendete Stufe → kein erneuter Versand", async () => {
    const supabase = mockSupabase({
      profil: baseProfil,
      abgeschlossene: abgeschlossenBisJan2026(),
      gesendet: [{ periode_key: "2026-2", stufe: "14_tage" }],
      email: "inhaber@firma.de",
    });
    const versender = vi.fn();
    const res = await laufFristenErinnerung({
      supabase,
      heute: "2026-02-28",
      appUrl: "https://app.de",
      versender,
    });
    expect(res.status).toBe("keine_frist_faellig");
    expect(versender).not.toHaveBeenCalled();
  });

  it("Versand fehlgeschlagen/no-op → kein Log-Insert", async () => {
    const supabase = mockSupabase({
      profil: baseProfil,
      abgeschlossene: abgeschlossenBisJan2026(),
      gesendet: [],
      email: "inhaber@firma.de",
    });
    const versender = vi
      .fn()
      .mockResolvedValue({ gesendet: false, grund: "kein_api_key" });
    const res = await laufFristenErinnerung({
      supabase,
      heute: "2026-02-28",
      appUrl: "https://app.de",
      versender,
    });
    expect(res.status).toBe("versand_uebersprungen");
    const inserts = (supabase as unknown as { __inserts: unknown[] }).__inserts;
    expect(inserts).toHaveLength(0);
  });
});
