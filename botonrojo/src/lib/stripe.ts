import Stripe from "stripe";
import { env } from "./env";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

export type CheckoutInput = {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  affiliateRef?: string;
  launchId?: string;
  utm?: Record<string, string | undefined>;
};

export async function createCheckoutSession(input: CheckoutInput) {
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
