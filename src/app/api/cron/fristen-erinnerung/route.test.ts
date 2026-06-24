// PROJ-32 (AC4): Schutz-Test des Cron-Endpoints (401 ohne gültiges Secret).
// Der Runner wird gemockt, damit kein Versand/DB-Zugriff stattfindet.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}) as never,
}));

const laufMock = vi.fn();
vi.mock("@/lib/fristen/cron-runner", () => ({
  laufFristenErinnerung: (...args: unknown[]) => laufMock(...args),
}));

import { GET } from "./route";

const ORIG = process.env.CRON_SECRET;

beforeEach(() => {
  laufMock.mockReset();
  process.env.CRON_SECRET = "geheim";
});

afterEach(() => {
  if (ORIG === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = ORIG;
});

function req(authHeader?: string): Request {
  return new Request("https://app.de/api/cron/fristen-erinnerung", {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("GET /api/cron/fristen-erinnerung", () => {
  it("401 ohne Authorization-Header", async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(laufMock).not.toHaveBeenCalled();
  });

  it("401 bei falschem Secret", async () => {
    const res = await GET(req("Bearer falsch"));
    expect(res.status).toBe(401);
    expect(laufMock).not.toHaveBeenCalled();
  });

  it("401 wenn CRON_SECRET nicht konfiguriert ist", async () => {
    delete process.env.CRON_SECRET;
    const res = await GET(req("Bearer egal"));
    expect(res.status).toBe(401);
    expect(laufMock).not.toHaveBeenCalled();
  });

  it("200 + Summary bei gültigem Secret", async () => {
    laufMock.mockResolvedValue({
      geprueft: 1,
      gesendet: false,
      status: "keine_frist_faellig",
      detail: "ok",
    });
    const res = await GET(req("Bearer geheim"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("keine_frist_faellig");
    expect(laufMock).toHaveBeenCalledOnce();
  });
});
