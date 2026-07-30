import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
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

// Separate derived key from the AES one: signing URLs and encrypting client
// credentials are different jobs and must not share key material.
let cachedSigningKey: Buffer | null = null;
function getSigningKey(): Buffer {
  if (!env.APP_ENCRYPTION_KEY) {
    throw new Error("APP_ENCRYPTION_KEY no está configurada — no se pueden firmar URLs internas.");
  }
  if (!cachedSigningKey) {
    cachedSigningKey = scryptSync(env.APP_ENCRYPTION_KEY, "botonrojo-url-signing", 32);
  }
  return cachedSigningKey;
}

/**
 * Signs a JSON payload into a `{p, sig}` pair for URLs that must be readable
 * by something without a session — specifically the headless Chromium in
 * `screenshot-service`, which renders the ad-creative page. Without this the
 * render route would either be open to anyone or unreachable by the service.
 */
export function signPayload(payload: unknown): { p: string; sig: string } {
  const p = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getSigningKey()).update(p).digest("base64url");
  return { p, sig };
}

/** Returns the payload only if the signature matches; null otherwise. */
export function verifyPayload<T>(p: string, sig: string): T | null {
  try {
    const expected = createHmac("sha256", getSigningKey()).update(p).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}
