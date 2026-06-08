import { describe, it, expect } from "vitest";
import { mapActionError } from "./action-errors";

describe("mapActionError", () => {
  it("maps a unique violation (23505) to already_invited", () => {
    expect(mapActionError({ code: "23505", message: "duplicate key" })).toBe(
      "already_invited",
    );
  });

  it("maps the last-admin guard to last_admin", () => {
    expect(mapActionError({ message: "org_must_keep_one_admin" })).toBe(
      "last_admin",
    );
  });

  it("passes through an unknown message", () => {
    expect(mapActionError({ message: "boom" })).toBe("boom");
  });

  it("falls back to 'failed' without error info", () => {
    expect(mapActionError(null)).toBe("failed");
    expect(mapActionError(undefined)).toBe("failed");
    expect(mapActionError({})).toBe("failed");
  });

  it("prioritizes the error code over the message", () => {
    expect(
      mapActionError({ code: "23505", message: "org_must_keep_one_admin" }),
    ).toBe("already_invited");
  });
});
