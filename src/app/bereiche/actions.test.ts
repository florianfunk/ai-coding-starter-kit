import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("REDIRECT"); }) }));

const fromMock = vi.fn();
const supabaseMock = { from: fromMock, storage: { from: vi.fn() } };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => supabaseMock }));

import { createBereich, deleteBereich } from "./actions";

beforeEach(() => {
  fromMock.mockReset();
});

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("createBereich", () => {
  it("rejects empty name", async () => {
    const res = await createBereich({ error: null }, form({ name: "" }));
    expect(res.error).not.toBeNull();
    expect(res.fieldErrors?.name).toMatch(/Pflicht/);
  });

  it("inserts and redirects on valid input", async () => {
    fromMock.mockReturnValueOnce({ insert: vi.fn().mockResolvedValueOnce({ error: null }) });
    await expect(
      createBereich({ error: null }, form({ name: "LED STRIP", sortierung: "10" })),
    ).rejects.toThrow("REDIRECT");
  });
});

describe("deleteBereich", () => {
  it("blocks delete when kategorien exist", async () => {
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValueOnce({ count: 5, error: null }),
    });
    const res = await deleteBereich("xyz");
    expect(res.error).toMatch(/5 Kategorien/);
  });

  it("deletes when no kategorien", async () => {
    fromMock
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValueOnce({ count: 0, error: null }),
      })
      .mockReturnValueOnce({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      });
    const res = await deleteBereich("xyz");
    expect(res.error).toBeNull();
  });
});
