import { describe, it, expect } from "vitest";
import {
  klassifizierungInputSchema,
  MAX_BUCHUNG_IDS,
} from "./klassifizierung";

const UUID_A = "1a1edf1c-328d-4130-b8e0-d6d693ae12fd";
const UUID_B = "32b26e89-82dd-4ca4-b8fe-cc84d38e9268";

describe("klassifizierungInputSchema", () => {
  it("akzeptiert einen leeren Body mit Defaults", () => {
    const r = klassifizierungInputSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.nur_offen).toBe(true);
      expect(r.data.konfidenz_schwellwert).toBe(0.85);
      expect(r.data.betrag_limit).toBe(2000);
      expect(r.data.buchung_ids).toBeUndefined();
    }
  });

  it("akzeptiert eine gültige buchung_ids-Liste (UUIDs)", () => {
    const r = klassifizierungInputSchema.safeParse({
      buchung_ids: [UUID_A, UUID_B],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.buchung_ids).toEqual([UUID_A, UUID_B]);
    }
  });

  it("dedupliziert keine Werte (Route filtert .in() ohnehin), akzeptiert aber Wiederholungen", () => {
    const r = klassifizierungInputSchema.safeParse({
      buchung_ids: [UUID_A, UUID_A],
    });
    expect(r.success).toBe(true);
  });

  it("lehnt eine leere buchung_ids-Liste ab (422)", () => {
    const r = klassifizierungInputSchema.safeParse({ buchung_ids: [] });
    expect(r.success).toBe(false);
  });

  it("lehnt nicht-UUID-Werte in buchung_ids ab (422)", () => {
    const r = klassifizierungInputSchema.safeParse({
      buchung_ids: ["kein-uuid"],
    });
    expect(r.success).toBe(false);
  });

  it("lehnt buchung_ids ab, wenn es kein Array ist (422)", () => {
    const r = klassifizierungInputSchema.safeParse({
      buchung_ids: UUID_A,
    });
    expect(r.success).toBe(false);
  });

  it("kappt buchung_ids bei einem sinnvollen Limit (422 darüber)", () => {
    const zuViele = Array.from({ length: MAX_BUCHUNG_IDS + 1 }, () => UUID_A);
    const r = klassifizierungInputSchema.safeParse({ buchung_ids: zuViele });
    expect(r.success).toBe(false);
  });

  it("akzeptiert genau MAX_BUCHUNG_IDS Einträge", () => {
    const grenze = Array.from({ length: MAX_BUCHUNG_IDS }, () => UUID_A);
    const r = klassifizierungInputSchema.safeParse({ buchung_ids: grenze });
    expect(r.success).toBe(true);
  });

  it("kombiniert buchung_ids mit Schwellwert/Limit", () => {
    const r = klassifizierungInputSchema.safeParse({
      buchung_ids: [UUID_A],
      konfidenz_schwellwert: 0.7,
      betrag_limit: 500,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.buchung_ids).toEqual([UUID_A]);
      expect(r.data.konfidenz_schwellwert).toBe(0.7);
    }
  });
});
