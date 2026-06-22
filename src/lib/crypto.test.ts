import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createCipheriv, scryptSync, randomBytes } from "node:crypto";
import { encrypt, decrypt, CRYPTO_VERSION } from "./crypto";

const KEY_A = "schluessel-A-mindestens-32-zeichen-lang-xx";
const KEY_B = "schluessel-B-mindestens-32-zeichen-lang-yy";

/** Erzeugt ein Payload im alten, unversionierten Format <iv>.<tag>.<data>. */
function legacyEncrypt(plain: string, secret: string): string {
  const k = scryptSync(secret, "steueragent-salt", 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

describe("crypto", () => {
  beforeEach(() => {
    process.env.STEUERAGENT_ENCRYPTION_KEY = KEY_A;
    delete process.env.STEUERAGENT_ENCRYPTION_KEY_OLD;
  });
  afterEach(() => {
    delete process.env.STEUERAGENT_ENCRYPTION_KEY;
    delete process.env.STEUERAGENT_ENCRYPTION_KEY_OLD;
  });

  it("Round-Trip: ver- und entschlüsselt", () => {
    const c = encrypt("geheimes-token-123");
    expect(decrypt(c)).toBe("geheimes-token-123");
  });

  it("erzeugt versionierte Payloads (v1.<iv>.<tag>.<data>)", () => {
    const c = encrypt("x");
    const teile = c.split(".");
    expect(teile).toHaveLength(4);
    expect(teile[0]).toBe(CRYPTO_VERSION);
  });

  it("entschlüsselt Legacy-Payloads (unversioniert)", () => {
    const legacy = legacyEncrypt("alt-aber-gueltig", KEY_A);
    expect(legacy.split(".")).toHaveLength(3);
    expect(decrypt(legacy)).toBe("alt-aber-gueltig");
  });

  it("Key-Rotation: entschlüsselt mit OLD-Schlüssel, wenn Primär neu ist", () => {
    // Daten wurden mit KEY_A verschlüsselt …
    const c = encrypt("rotations-token");
    // … dann Rotation: neuer Primärschlüssel B, alter A als OLD.
    process.env.STEUERAGENT_ENCRYPTION_KEY = KEY_B;
    process.env.STEUERAGENT_ENCRYPTION_KEY_OLD = KEY_A;
    expect(decrypt(c)).toBe("rotations-token");
    // Neu verschlüsselt wird jetzt mit dem Primärschlüssel B.
    const neu = encrypt("neu");
    delete process.env.STEUERAGENT_ENCRYPTION_KEY_OLD;
    expect(decrypt(neu)).toBe("neu");
  });

  it("wirft bei falschem Schlüssel ohne Detail-Leak", () => {
    const c = encrypt("token");
    process.env.STEUERAGENT_ENCRYPTION_KEY = KEY_B; // falscher Schlüssel, kein OLD
    expect(() => decrypt(c)).toThrow(/Entschlüsselung fehlgeschlagen/);
  });

  it("wirft bei kaputtem Format", () => {
    expect(() => decrypt("nur-ein-segment")).toThrow(/Payload-Format/);
  });
});
