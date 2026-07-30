import "server-only";
import Stripe from "stripe";
import { getDecryptedCredential } from "@/server/integrations";
import type { StripeCredentials } from "@/server/integrations";

const clientCache = new Map<string, Stripe>();

/** Each organization brings its own Stripe account — no shared/global client. */
export async function getStripeClientForOrg(organizationId: string): Promise<Stripe> {
  const cached = clientCache.get(organizationId);
  if (cached) return cached;

  const creds = await getDecryptedCredential<StripeCredentials>(organizationId, "stripe");
  if (!creds) throw new Error("stripe_not_configured");

  const client = new Stripe(creds.secretKey, { apiVersion: "2025-02-24.acacia", typescript: true });
  clientCache.set(organizationId, client);
  return client;
}

export async function getStripeCredentialsForOrg(organizationId: string): Promise<StripeCredentials | null> {
  return getDecryptedCredential<StripeCredentials>(organizationId, "stripe");
}

export type CheckoutInput = {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  affiliateRef?: string;
  launchId?: string;
  utm?: Record<string, string | undefined>;
};

export async function createCheckoutSession(organizationId: string, input: CheckoutInput) {
  const stripe = await getStripeClientForOrg(organizationId);

  const metadata: Record<string, string> = {};
  if (input.affiliateRef) metadata.affiliate_ref = input.affiliateRef;
  if (input.launchId) metadata.launch_id = input.launchId;
  for (const [k, v] of Object.entries(input.utm ?? {})) {
    if (v) metadata[`utm_${k}`] = v;
  }

  return stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: input.priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.customerEmail,
    allow_promotion_codes: true,
    metadata,
    payment_intent_data: { metadata },
  });
}
