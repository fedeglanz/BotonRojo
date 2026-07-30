import { Client } from "minio";
import { env } from "@/lib/env";

const url = new URL(env.S3_ENDPOINT);

export const storage = new Client({
  endPoint: url.hostname,
  port: Number(url.port) || (url.protocol === "https:" ? 443 : 80),
  useSSL: url.protocol === "https:",
  accessKey: env.S3_ACCESS_KEY,
  secretKey: env.S3_SECRET_KEY,
  region: env.S3_REGION,
});

export const BUCKET = env.S3_BUCKET;

export async function ensureBucket(): Promise<void> {
  const exists = await storage.bucketExists(BUCKET).catch(() => false);
  if (!exists) await storage.makeBucket(BUCKET, env.S3_REGION);

  // Make objects public-readable (dev convenience)
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${BUCKET}/*`],
      },
    ],
  };
  await storage.setBucketPolicy(BUCKET, JSON.stringify(policy)).catch(() => {});
}

export function publicUrlFor(key: string): string {
  return `${env.S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}

/** Best-effort delete — a missing object is not an error worth surfacing when
 * the caller's real goal is "this file should no longer exist". */
export async function removeObject(key: string): Promise<void> {
  await storage.removeObject(BUCKET, key).catch(() => {});
}

/**
 * Rewrites a public storage URL to one the screenshot container can fetch.
 * Only needed when the two differ (local dev: localhost:9000 for the browser
 * vs host.docker.internal:9000 inside the container). A stored image that
 * silently fails to load would produce a finished ad with a blank background,
 * so this is not cosmetic.
 */
export function internalAssetUrl(url: string): string {
  if (!env.STORAGE_INTERNAL_URL) return url;
  const publicBase = env.S3_PUBLIC_URL.replace(/\/$/, "");
  if (!url.startsWith(publicBase)) return url;
  return `${env.STORAGE_INTERNAL_URL.replace(/\/$/, "")}${url.slice(publicBase.length)}`;
}
