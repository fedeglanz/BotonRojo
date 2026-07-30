import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_SECRET: z.string().min(16).default("dev_secret_change_me_dev_secret_change_me"),

  DATABASE_URL: z.string().url().default("postgres://botonrojo:botonrojo@localhost:5432/botonrojo"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Platform-level (shared, the platform operator pays for these — not per-client).
  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  UNSPLASH_ACCESS_KEY: z.string().default(""),
  MAGNIFIC_API_KEY: z.string().default(""),

  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default("Botón Rojo <hola@example.com>"),

  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().default("botonrojo"),
  S3_ACCESS_KEY: z.string().default("botonrojo"),
  S3_SECRET_KEY: z.string().default("botonrojo_secret"),
  S3_PUBLIC_URL: z.string().default("http://localhost:9000/botonrojo"),

  ACTIVECAMPAIGN_API_URL: z.string().default(""),
  ACTIVECAMPAIGN_API_KEY: z.string().default(""),
  ACTIVECAMPAIGN_FROM_NAME: z.string().default("Escuela Nómada Digital"),
  ACTIVECAMPAIGN_FROM_EMAIL: z.string().default("hola@escuelanomadadigital.com"),

  TELEGRAM_BOT_TOKEN: z.string().default(""),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(""),
  NOTION_TOKEN: z.string().default(""),
  YOUTUBE_API_KEY: z.string().default(""),
  META_ACCESS_TOKEN: z.string().default(""),
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().default(""),

  GEOIP_PROVIDER_URL: z.string().default("https://ip.guide"),

  // Custom domains: the IPv4 clients point an A record at for apex domains.
  SERVER_IPV4: z.string().default(""),

  // Design review: a sidecar Docker service (Playwright) that screenshots a
  // just-generated landing so Claude can visually review it. Unset = the
  // review step is skipped entirely (landings still generate normally).
  SCREENSHOT_SERVICE_URL: z.string().default(""),
  SCREENSHOT_SERVICE_TOKEN: z.string().default(""),
  // How the screenshot service reaches this app internally — the compose
  // service name in production (`http://app:3000`), but `pnpm dev` runs on
  // the host outside the compose network, so local dev needs
  // `http://host.docker.internal:3000` instead.
  SCREENSHOT_APP_URL: z.string().default("http://app:3000"),
  // Where the screenshot container can reach object storage, when that differs
  // from S3_PUBLIC_URL. In local dev the browser uses localhost:9000 but the
  // container needs host.docker.internal:9000 — no single value works for
  // both. Empty = storage URLs are already reachable from the container.
  STORAGE_INTERNAL_URL: z.string().default(""),

  // Encrypts every client's own Stripe/ActiveCampaign/etc. credentials at rest
  // (see src/lib/crypto.ts). Generate once with `openssl rand -base64 32` and
  // never rotate casually — changing it makes all stored credentials unreadable.
  APP_ENCRYPTION_KEY: z.string().default(""),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
