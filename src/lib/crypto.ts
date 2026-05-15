import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Symmetrische Verschlüsselung sensibler Stammdaten (z.B. Paperless-Token).
 * Nur serverseitig verwenden. Schlüssel aus STEUERAGENT_ENCRYPTION_KEY.
 */
const ALGO = "aes-256-gcm";

function key() {
  const secret = process.env.STEUERAGENT_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("STEUERAGENT_ENCRYPTION_KEY fehlt oder zu kurz (min. 32 Zeichen).");
  }
  return scryptSync(secret, "steueragent-salt", 32);
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
