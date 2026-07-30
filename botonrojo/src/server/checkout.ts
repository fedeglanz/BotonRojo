"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { products, trackingEvents, launches, users, orders } from "@/db/schema";
import { env } from "@/lib/env";
import { createCheckoutSession } from "@/lib/stripe";
import { getActiveCampaignClientForOrg } from "@/integrations/activecampaign";
import { sendAutomatedTelegramMessage } from "@/server/launches";

/**
 * Resolves which launch a /gracias visit belongs to, so that page can be
 * themed with the right brand kit instead of showing Botón Rojo's own look.
 * Leads carry the slug directly in the redirect URL; purchases only carry
 * the Stripe session id, so we look up the order our webhook wrote (falls
 * back to the generic, unbranded thank-you if that hasn't landed yet).
 */
export async function resolveGraciasLaunch(params: { launchSlug?: string; sessionId?: string }) {
  if (params.launchSlug) {
    const [launch] = await db.select().from(launches).where(eq(launches.slug, params.launchSlug)).limit(1);
    return launch ?? null;
  }

  if (params.sessionId) {
    const [order] = await db.select().from(orders).where(eq(orders.stripeSessionId, params.sessionId)).limit(1);
    if (order?.launchId) {
      const [launch] = await db.select().from(launches).where(eq(launches.id, order.launchId)).limit(1);
      return launch ?? null;
    }
  }

  return null;
}

export async function startCheckoutAction(formData: FormData) {
  const productSlug = String(formData.get("productSlug") ?? "");
  const email = (formData.get("email") ? String(formData.get("email")) : "").trim() || undefined;
  const ref = (formData.get("ref") ? String(formData.get("ref")) : "").trim() || undefined;

  const [product] = await db.select().from(products).where(eq(products.slug, productSlug)).limit(1);
  if (!product?.stripePriceId) throw new Error("product_not_configured");
  if (!product.organizationId) throw new Error("product_not_configured");

  const session = await createCheckoutSession(product.organizationId, {
    priceId: product.stripePriceId,
    successUrl: `${env.APP_URL}/gracias?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${env.APP_URL}/${productSlug}`,
    customerEmail: email,
    affiliateRef: ref,
    launchId: product.launchId ?? undefined,
  });

  // Apply "abandono" tag — will be overridden by "comprador" if purchase completes
  if (email && product.launchId) {
    const [launch] = await db.select().from(launches).where(eq(launches.id, product.launchId)).limit(1);
    if (launch) {
      const ac = await getActiveCampaignClientForOrg(product.organizationId);
      if (ac) {
        const tagIds = (launch.activeCampaignTagIds ?? {}) as Record<string, number>;
        const abandonoTagId = tagIds.abandono;
        if (abandonoTagId) {
          ac.syncLeadToAc({
            email,
            launchSlug: launch.slug,
            launchListId: launch.activeCampaignListId ?? null,
            launchTagIds: tagIds,
            intent: "registro",
          })
            .then((contact) => {
              if (contact) ac.applyTag(contact.id, String(abandonoTagId));
            })
            .catch((err) => console.error("AC abandono tag failed", err));
        }
      }
    }
  }

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
    organizationId: launch?.organizationId ?? null,
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

  if (launch) {
    const ac = await getActiveCampaignClientForOrg(launch.organizationId);
    ac?.syncLeadToAc({
      email,
      name,
      launchSlug: launch.slug,
      launchListId: launch.activeCampaignListId ?? null,
      launchTagIds: (launch.activeCampaignTagIds ?? {}) as Record<string, number>,
      intent: "registro",
    }).catch((err) => console.error("AC sync (landing lead) failed", err));
  }

  // Telegram on_lead automation (token resolved inside via org)
  if (launch?.telegramChatId && launch.organizationId) {
    sendAutomatedTelegramMessage({
      chatId: launch.telegramChatId,
      launchId: launch.id,
      organizationId: launch.organizationId,
      event: "on_lead",
      leadName: name,
      email,
    }).catch((err) => console.error("Telegram on_lead (landing) failed", err));
  }

  redirect(`/gracias?lead=1&launch=${launchSlug}`);
}
