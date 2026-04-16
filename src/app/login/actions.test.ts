import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("REDIRECT"); }) }));

const signInWithPassword = vi.fn();
const resetPasswordForEmail = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword,
      resetPasswordForEmail,
      signOut: vi.fn(),
      updateUser: vi.fn(),
    },
  }),
}));

import { loginAction, requestPasswordResetAction } from "./actions";

beforeEach(() => {
  signInWithPassword.mockReset();
  resetPasswordForEmail.mockReset();
});

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

describe("loginAction", () => {
  it("rejects invalid email", async () => {
    const result = await loginAction({ error: null }, form({ email: "x", password: "y" }));
    expect(result.error).toMatch(/ungültig/i);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("returns generic error on supabase failure (no email leak)", async () => {
    signInWithPassword.mockResolvedValueOnce({ error: { message: "User not found" } });
    const result = await loginAction({ error: null }, form({ email: "a@b.de", password: "secret" }));
    expect(result.error).toBe("E-Mail oder Passwort ungültig.");
    expect(result.error).not.toContain("User");
  });

  it("redirects on success", async () => {
    signInWithPassword.mockResolvedValueOnce({ error: null });
    await expect(
      loginAction({ error: null }, form({ email: "a@b.de", password: "secret" })),
    ).rejects.toThrow("REDIRECT");
  });
});

describe("requestPasswordResetAction", () => {
  it("never leaks whether email exists", async () => {
    resetPasswordForEmail.mockResolvedValueOnce({ error: { message: "not found" } });
    const result = await requestPasswordResetAction({ error: null }, form({ email: "a@b.de" }));
    expect(result.error).toBeNull();
  });
});
