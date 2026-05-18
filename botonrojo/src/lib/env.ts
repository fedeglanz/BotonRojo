import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  NEXTAUTH_SECRET: z.string().min(16).default("dev_secret_change_me_dev_secret_change_me"),

  DATABASE_URL: z.string().url().default("postgres://botonrojo:botonrojo@localhost:5432/botonrojo"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default(""),

  ANTHROPIC_API_KEY: z.string().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),

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
  NOTION_TOKEN: z.string().default(""),
  YOUTUBE_API_KEY: z.string().default(""),
  META_ACCESS_TOKEN: z.string().default(""),
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().default(""),

  GEOIP_PROVIDER_URL: z.string().default("https://ip.guide"),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
