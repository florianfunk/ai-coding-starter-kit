import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Symmetrische Verschlüsselung sensibler Stammdaten (z.B. Paperless-Token).
 * Nur serverseitig verwenden. Schlüssel aus STEUERAGENT_ENCRYPTION_KEY.
 *
 * Payload-Format (versioniert, ermöglicht spätere Key-Rotation):
 *   "v1.<iv>.<tag>.<data>"   (alle Teile base64)
 *
 * Abwärtskompatibilität: alte, unversionierte Payloads "<iv>.<tag>.<data>"
 * (3 Segmente) werden weiterhin entschlüsselt.
 *
 * Key-Rotation: `decrypt` probiert nacheinander den primären Schlüssel
 * (STEUERAGENT_ENCRYPTION_KEY) und – falls gesetzt – den vorherigen
 * (STEUERAGENT_ENCRYPTION_KEY_OLD). So kann der Schlüssel gewechselt werden,
 * ohne bestehende Daten sofort neu zu verschlüsseln; `encrypt` nutzt immer
 * den primären Schlüssel.
 */
const ALGO = "aes-256-gcm";

/** Aktuelle Payload-Version (Prefix). */
export const CRYPTO_VERSION = "v1";

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, "steueragent-salt", 32);
}

/** Primärer Schlüssel (zum Verschlüsseln + bevorzugt beim Entschlüsseln). */
function primaerSecret(): string {
  const secret = process.env.STEUERAGENT_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("STEUERAGENT_ENCRYPTION_KEY fehlt oder zu kurz (min. 32 Zeichen).");
  }
  return secret;
}

/** Alle Schlüssel für die Entschlüsselung (primär, dann optional vorheriger). */
function alleSecrets(): string[] {
  const secrets = [primaerSecret()];
  const alt = process.env.STEUERAGENT_ENCRYPTION_KEY_OLD;
  if (alt && alt.length >= 32) secrets.push(alt);
  return secrets;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, deriveKey(primaerSecret()), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    CRYPTO_VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(".");
}

function decryptMitSecret(
  ivB64: string,
  tagB64: string,
  dataB64: string,
  secret: string,
): string {
  const decipher = createDecipheriv(
    ALGO,
    deriveKey(secret),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function decrypt(payload: string): string {
  const teile = payload.split(".");

  let ivB64: string;
  let tagB64: string;
  let dataB64: string;
  if (teile.length === 4 && teile[0] === CRYPTO_VERSION) {
    [, ivB64, tagB64, dataB64] = teile;
  } else if (teile.length === 3) {
    // Legacy: unversioniertes Format <iv>.<tag>.<data>.
    [ivB64, tagB64, dataB64] = teile;
  } else {
    throw new Error("Ungültiges verschlüsseltes Payload-Format.");
  }

  let letzterFehler: unknown;
  for (const secret of alleSecrets()) {
    try {
      return decryptMitSecret(ivB64, tagB64, dataB64, secret);
    } catch (err) {
      letzterFehler = err;
    }
  }
  throw new Error(
    `Entschlüsselung fehlgeschlagen (Schlüssel passt nicht oder Daten beschädigt)${
      letzterFehler instanceof Error ? `: ${letzterFehler.message}` : ""
    }.`,
  );
}
