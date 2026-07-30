import { NextRequest, NextResponse } from "next/server";
import { getStripeClientForOrg, getStripeCredentialsForOrg } from "@/lib/stripe";
import { db } from "@/db";
import { orders, trackingEvents, users, launches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getActiveCampaignClientForOrg } from "@/integrations/activecampaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Each organization brings its own Stripe account, so each gets its own
 * webhook URL (configured in their Stripe dashboard when they connect) —
 * there's no single shared webhook secret to verify against anymore.
 */
export async function POST(req: NextRequest, props: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await props.params;

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing_signature" }, { status: 400 });

  const creds = await getStripeCredentialsForOrg(organizationId);
  if (!creds) return NextResponse.json({ error: "organization_not_configured" }, { status: 404 });

  const stripe = await getStripeClientForOrg(organizationId);

  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, creds.webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `webhook_invalid: ${(err as Error).message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as import("stripe").Stripe.Checkout.Session;

    const affiliateRef = (session.metadata?.affiliate_ref as string | undefined) ?? null;
    const launchId = (session.metadata?.launch_id as string | undefined) ?? null;

    let affiliateUserId: string | null = null;
    if (affiliateRef) {
      const [aff] = await db.select().from(users).where(eq(users.affiliateCode, affiliateRef)).limit(1);
      if (aff) affiliateUserId = aff.id;
    }

    await db.insert(orders).values({
      organizationId,
      stripeSessionId: session.id,
      stripePaymentIntentId: (session.payment_intent as string) ?? null,
      email: session.customer_details?.email ?? session.customer_email ?? null,
      customerName: session.customer_details?.name ?? null,
      amountCents: session.amount_total ?? 0,
      currency: (session.currency ?? "eur").toUpperCase(),
      launchId,
      affiliateRef,
      status: "paid",
      metadata: (session.metadata as Record<string, string>) ?? {},
    });

    await db.insert(trackingEvents).values({
      organizationId,
      type: "sale",
      email: session.customer_details?.email ?? session.customer_email ?? null,
      name: session.customer_details?.name ?? null,
      affiliateRef,
      affiliateUserId,
      launchId,
      amountCents: session.amount_total ?? 0,
      currency: (session.currency ?? "eur").toUpperCase(),
      stripeSessionId: session.id,
      stripePaymentIntentId: (session.payment_intent as string) ?? null,
      utmSource: (session.metadata?.utm_source as string | undefined) ?? null,
      utmMedium: (session.metadata?.utm_medium as string | undefined) ?? null,
      utmCampaign: (session.metadata?.utm_campaign as string | undefined) ?? null,
      payload: (session.metadata as Record<string, string>) ?? {},
    });

    if (launchId) {
      const [launch] = await db.select().from(launches).where(eq(launches.id, launchId)).limit(1);
      const email = session.customer_details?.email ?? session.customer_email;
      if (launch && email) {
        const ac = await getActiveCampaignClientForOrg(organizationId);
        ac?.syncLeadToAc({
          email,
          name: session.customer_details?.name ?? undefined,
          launchSlug: launch.slug,
          launchListId: launch.activeCampaignListId ?? null,
          launchTagIds: (launch.activeCampaignTagIds ?? {}) as Record<string, number>,
          intent: "comprador",
        }).catch((err) => console.error("AC sync (sale) failed", err));
      }
    }
  }

  return NextResponse.json({ received: true });
}
