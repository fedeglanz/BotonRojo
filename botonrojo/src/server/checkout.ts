"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { products, trackingEvents, launches, users } from "@/db/schema";
import { env } from "@/lib/env";
import { stripe, createCheckoutSession } from "@/lib/stripe";
import { syncLeadToAc, isActiveCampaignConfigured } from "@/integrations/activecampaign";

export async function startCheckoutAction(formData: FormData) {
  const productSlug = String(formData.get("productSlug") ?? "");
  const email = (formData.get("email") ? String(formData.get("email")) : "").trim() || undefined;
  const ref = (formData.get("ref") ? String(formData.get("ref")) : "").trim() || undefined;

  const [product] = await db.select().from(products).where(eq(products.slug, productSlug)).limit(1);
  if (!product?.stripePriceId) throw new Error("product_not_configured");
  if (!env.STRIPE_SECRET_KEY || env.STRIPE_SECRET_KEY.startsWith("sk_test_xxx")) {
    throw new Error("stripe_not_configured");
  }

  const session = await createCheckoutSession({
    priceId: product.stripePriceId,
    successUrl: `${env.APP_URL}/gracias?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${env.APP_URL}/${productSlug}`,
    customerEmail: email,
    affiliateRef: ref,
    launchId: product.launchId ?? undefined,
  });

  if (!session.url) throw new Error("stripe_session_failed");
  redirect(session.url);
}

export async function captureLeadAction(formData: FormData) {
  const launchSlug = String(formData.get("launchSlug") ?? "");
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const name = String(formData.get("name") ?? "").trim() || undefined;
  const ref = (formData.get("ref") ? String(formData.get("ref")) : "").trim() || undefined;
  const privacyAccepted = formData.get("privacyAccepted") === "on";
  const marketingConsent = formData.get("marketingConsent") === "on";

  // Name, email and both consent checkboxes are mandatory — the checkbox
  // `required` attribute blocks this client-side, this is the server-side backstop.
  if (!email || !name || !launchSlug || !privacyAccepted || !marketingConsent) {
    throw new Error("missing_required_fields");
  }

  const [launch] = await db.select().from(launches).where(eq(launches.slug, launchSlug)).limit(1);

  let affiliateUserId: string | null = null;
  if (ref) {
    const [aff] = await db.select().from(users).where(eq(users.affiliateCode, ref)).limit(1);
    if (aff) affiliateUserId = aff.id;
  }

  await db.insert(trackingEvents).values({
    type: "lead",
    email,
    name,
    affiliateRef: ref,
    affiliateUserId,
    launchId: launch?.id ?? null,
    payload: {
      source: "landing_form",
      privacyAccepted,
      marketingConsent,
      consentedAt: new Date().toISOString(),
    },
  });

  if (isActiveCampaignConfigured() && launch) {
    syncLeadToAc({
      email,
      name,
      launchSlug: launch.slug,
      launchListId: launch.activeCampaignListId ?? null,
      launchTagIds: (launch.activeCampaignTagIds ?? {}) as Record<string, number>,
      intent: "registro",
    }).catch((err) => console.error("AC sync (landing lead) failed", err));
  }

  redirect(`/gracias?lead=1&launch=${launchSlug}`);
}
