"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  products,
  trackingEvents,
  launches,
  users,
  orders,
  domains,
} from "@/db/schema";
import { env } from "@/lib/env";
import { createCheckoutSession } from "@/lib/stripe";
import { getActiveCampaignClientForOrg } from "@/integrations/activecampaign";
import { sendAutomatedTelegramMessage } from "@/server/launches";
import {
  resolvePages,
  pagePath,
  type PageConfig,
} from "@/lib/launch-pages";
import type { LaunchType } from "@/lib/launch-types";

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

/**
 * El dominio por el que ha entrado el visitante, para las URLs de vuelta de Stripe.
 *
 * Fijas a `APP_URL`, un comprador que estaba en el dominio de su formador acababa
 * el pago en el dominio de la plataforma — la marca cambiaba justo en el
 * momento de más desconfianza de todo el proceso.
 *
 * Solo se acepta un dominio que esté verificado y activo en la base de datos. El
 * `Host` lo pone quien llama, y una URL de vuelta construida con ese valor sin
 * comprobar sería una forma de que Stripe mandase al comprador a donde quisiera
 * quien manipulase la cabecera.
 */
async function requestOrigin(): Promise<string> {
  const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase();
  if (!host || env.APP_URL.includes(host)) return env.APP_URL;

  const [dominio] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.hostname, host), eq(domains.status, "active")))
    .limit(1);

  return dominio ? `https://${host}` : env.APP_URL;
}

export async function startCheckoutAction(formData: FormData) {
  const productSlug = String(formData.get("productSlug") ?? "");
  const email = (formData.get("email") ? String(formData.get("email")) : "").trim() || undefined;
  const ref = (formData.get("ref") ? String(formData.get("ref")) : "").trim() || undefined;

  const [product] = await db.select().from(products).where(eq(products.slug, productSlug)).limit(1);
  if (!product?.stripePriceId) throw new Error("product_not_configured");
  if (!product.organizationId) throw new Error("product_not_configured");

  const origen = await requestOrigin();
  const session = await createCheckoutSession(product.organizationId, {
    priceId: product.stripePriceId,
    successUrl: `${origen}/gracias?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origen}/${productSlug}`,
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

  // Si el lanzamiento tiene su propia página de gracias, ahí. En una newsletter esa
  // página es la entrega —el lead magnet, el primer paso, lo que se prometió— y
  // mandar a la de gracias genérica de la plataforma la dejaba sin visitas: existía,
  // se generaba y nadie llegaba a ella nunca.
  if (launch) {
    const propia = resolvePages(
      launch.type as LaunchType,
      launch.pageConfig as PageConfig | null,
    ).find((page) => page.kind === "gracias");
    if (propia) redirect(pagePath(launch.slug, propia));
  }

  redirect(`/gracias?lead=1&launch=${launchSlug}`);
}
