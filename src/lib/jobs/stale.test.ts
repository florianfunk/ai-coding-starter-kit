import { describe, expect, it } from "vitest";
import { beurteileLaufendenJob } from "./stale";

describe("beurteileLaufendenJob", () => {
  const jetzt = new Date("2026-08-08T12:00:00.000Z");

  it("blockiert einen aktuell laufenden Job", () => {
    expect(
      beurteileLaufendenJob(
        { id: "job-neu", created_at: "2026-08-08T11:55:00.000Z" },
        jetzt,
      ),
    ).toEqual({ status: "aktiv", job_id: "job-neu" });
  });

  it("gibt einen verwaisten Job nach 15 Minuten zur Fehlerbereinigung frei", () => {
    expect(
      beurteileLaufendenJob(
        { id: "job-alt", created_at: "2026-05-19T16:47:00.000Z" },
        jetzt,
      ),
    ).toEqual({ status: "veraltet", job_id: "job-alt" });
  });

  it("gibt ohne laufenden Job sofort frei", () => {
    expect(beurteileLaufendenJob(null, jetzt)).toEqual({ status: "frei" });
  });
});
