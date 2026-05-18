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
