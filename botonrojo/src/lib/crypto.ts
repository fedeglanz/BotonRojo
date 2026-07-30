import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { env } from "./env";

// Derives a stable 32-byte AES key from APP_ENCRYPTION_KEY once per process —
// the env value itself can be any length/format, scrypt normalizes it.
let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (!env.APP_ENCRYPTION_KEY) {
    throw new Error("APP_ENCRYPTION_KEY no está configurada — no se pueden guardar credenciales cifradas.");
  }
  if (!cachedKey) {
    cachedKey = scryptSync(env.APP_ENCRYPTION_KEY, "botonrojo-integration-credentials", 32);
  }
  return cachedKey;
}

/**
 * AES-256-GCM, format `iv:authTag:ciphertext` (hex) — same delimited-string
 * style as the password hash in `src/lib/passwords.ts`, but reversible since
 * these are credentials we need to actually use, not just verify.
 *
 * Changing APP_ENCRYPTION_KEY makes every previously-encrypted secret
 * unreadable — there is no key rotation here, only replace-and-reconnect.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(":");
  if (!ivHex || !authTagHex || !dataHex) throw new Error("invalid_encrypted_payload");

  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return decrypted.toString("utf8");
}

/** For display only — never round-trippable, just enough to recognize which credential is connected. */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}
