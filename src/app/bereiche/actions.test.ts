import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("REDIRECT");
  }),
}));

const fromMock = vi.fn();
const supabaseMock = { from: fromMock, storage: { from: vi.fn() } };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => supabaseMock,
}));

import { createBereich, deleteBereich } from "./actions";

beforeEach(() => {
  fromMock.mockReset();
});

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

// Generic chainable mock for a single Supabase call. Resolves to `final` when
// awaited (or when .single() is awaited). Every other method (.select, .eq,
// .insert, .update, .delete, ...) returns `this`.
function chain(final: { data?: unknown; error?: unknown; count?: number }) {
  const proxy: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "delete", "eq", "in", "order"];
  methods.forEach((m) => {
    proxy[m] = vi.fn(() => proxy);
  });
  proxy.single = vi.fn(() => Promise.resolve(final));
  proxy.then = (resolve: (v: unknown) => unknown) => resolve(final);
  return proxy;
}

describe("createBereich", () => {
  it("rejects empty name", async () => {
    const res = await createBereich({ error: null }, form({ name: "" }));
    expect(res.error).not.toBeNull();
    expect(res.fieldErrors?.name).toMatch(/Pflicht/);
  });

  it("inserts and redirects on valid input", async () => {
    // 1. insert into bereiche -> .select('id').single() returns the new id
    fromMock.mockReturnValueOnce(chain({ data: { id: "new-id" }, error: null }));
    // 2. logAudit inserts into audit_log
    fromMock.mockReturnValueOnce(chain({ error: null }));

    await expect(
      createBereich({ error: null }, form({ name: "LED STRIP", sortierung: "10" })),
    ).rejects.toThrow("REDIRECT");
  });
});

describe("deleteBereich", () => {
  it("blocks delete when kategorien exist", async () => {
    // Count check on kategorien table
    fromMock.mockReturnValueOnce(chain({ count: 5, error: null }));
    const res = await deleteBereich("xyz");
    expect(res.error).toMatch(/5 Kategorien/);
  });

  it("deletes when no kategorien", async () => {
    // 1. count check (no children)
    fromMock.mockReturnValueOnce(chain({ count: 0, error: null }));
    // 2. fetch name before delete
    fromMock.mockReturnValueOnce(chain({ data: { name: "Bereich X" }, error: null }));
    // 3. actual delete
    fromMock.mockReturnValueOnce(chain({ error: null }));
    // 4. logAudit
    fromMock.mockReturnValueOnce(chain({ error: null }));

    const res = await deleteBereich("xyz");
    expect(res.error).toBeNull();
  });
});
