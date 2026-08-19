"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { organizationIntegrations } from "@/db/schema";
import type { IntegrationProvider } from "@/db/schema/integration-credentials";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto";

export type StripeCredentials = { secretKey: string; webhookSecret: string; publishableKey: string };
export type ActiveCampaignCredentials = { apiUrl: string; apiKey: string; fromName: string; fromEmail: string };
export type PdcCheckoutCredentials = { siteUrl: string; apiKey: string };
export type SingleTokenCredentials = { token: string };

const PROVIDER_SCHEMAS = {
  stripe: z.object({
    secretKey: z.string().min(1),
    webhookSecret: z.string().min(1),
    publishableKey: z.string().min(1),
  }),
  activecampaign: z.object({
    apiUrl: z.string().url(),
    apiKey: z.string().min(1),
    fromName: z.string().min(1),
    fromEmail: z.string().email(),
  }),
  meta: z.object({ token: z.string().min(1) }),
  google_ads: z.object({ token: z.string().min(1) }),
  telegram: z.object({ token: z.string().min(1) }),
  notion: z.object({ token: z.string().min(1) }),
  youtube: z.object({ token: z.string().min(1) }),
  pdc_checkout: z.object({
    siteUrl: z.string().url(),
    apiKey: z.string().min(1),
  }),
} satisfies Record<IntegrationProvider, z.ZodTypeAny>;

function maskedPreviewFor(provider: IntegrationProvider, payload: Record<string, string>): string {
  const primary =
    "secretKey" in payload ? payload.secretKey : "apiKey" in payload ? payload.apiKey : payload.token;
  return maskSecret(primary ?? "");
}

export async function listIntegrations() {
  const { organizationId } = await requireOrgAdmin();
  const rows = await db
    .select({
      provider: organizationIntegrations.provider,
      maskedPreview: organizationIntegrations.maskedPreview,
      connectedAt: organizationIntegrations.connectedAt,
    })
    .from(organizationIntegrations)
    .where(eq(organizationIntegrations.organizationId, organizationId));

  return new Map(rows.map((r) => [r.provider, r]));
}

export async function saveIntegrationCredentialAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const provider = String(formData.get("provider") ?? "") as IntegrationProvider;
  const schema = PROVIDER_SCHEMAS[provider];
  if (!schema) throw new Error("unknown_provider");

  const raw: Record<string, string> = {};
  for (const key of Object.keys(schema.shape)) {
    raw[key] = String(formData.get(key) ?? "");
  }
  const parsed = schema.parse(raw) as Record<string, string>;

  const encryptedPayload = encryptSecret(JSON.stringify(parsed));
  const maskedPreview = maskedPreviewFor(provider, parsed);

  await db
    .insert(organizationIntegrations)
    .values({ organizationId, provider, encryptedPayload, maskedPreview })
    .onConflictDoUpdate({
      target: [organizationIntegrations.organizationId, organizationIntegrations.provider],
      set: { encryptedPayload, maskedPreview, updatedAt: new Date() },
    });

  revalidatePath("/admin/ajustes");
}

export async function disconnectIntegrationAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const provider = String(formData.get("provider") ?? "") as IntegrationProvider;

  await db
    .delete(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.organizationId, organizationId),
        eq(organizationIntegrations.provider, provider),
      ),
    );

  revalidatePath("/admin/ajustes");
}

/** Server-internal only — resolves and decrypts one organization's credentials for a provider. */
export async function getDecryptedCredential<T>(
  organizationId: string,
  provider: IntegrationProvider,
): Promise<T | null> {
  const [row] = await db
    .select({ encryptedPayload: organizationIntegrations.encryptedPayload })
    .from(organizationIntegrations)
    .where(
      and(
        eq(organizationIntegrations.organizationId, organizationId),
        eq(organizationIntegrations.provider, provider),
      ),
    )
    .limit(1);
  if (!row) return null;
  return JSON.parse(decryptSecret(row.encryptedPayload)) as T;
}
