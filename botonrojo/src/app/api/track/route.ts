import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { trackingEvents, launches, users } from "@/db/schema";
import { trackPayloadSchema, getClientIp, classifySource } from "@/lib/tracking";
import { isBot, isSuspiciousUa } from "@/lib/bots";
import { lookupGeoIp } from "@/lib/geoip";
import { syncLeadToAc, isActiveCampaignConfigured } from "@/integrations/activecampaign";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const userAgent = req.headers.get("user-agent");
  if (isBot(userAgent) || isSuspiciousUa(userAgent)) {
    return NextResponse.json({ ok: true, skipped: "bot" });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = trackPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const ip = getClientIp(req.headers);
  const geo = await lookupGeoIp(ip);

  let launchId: string | null = null;
  let launchAcListId: number | null = null;
  let launchAcTagIds: Record<string, number> = {};
  let launchSlug: string | null = null;
  if (data.launchSlug) {
    const [launch] = await db.select().from(launches).where(eq(launches.slug, data.launchSlug)).limit(1);
    if (launch) {
      launchId = launch.id;
      launchAcListId = launch.activeCampaignListId ?? null;
      launchAcTagIds = (launch.activeCampaignTagIds ?? {}) as Record<string, number>;
      launchSlug = launch.slug;
    }
  }

  let affiliateUserId: string | null = null;
  if (data.ref) {
    const [affiliate] = await db.select().from(users).where(eq(users.affiliateCode, data.ref)).limit(1);
    if (affiliate) affiliateUserId = affiliate.id;
  }

  const source = classifySource(data.utmSource, data.ref);

  if (
    isActiveCampaignConfigured() &&
    data.email &&
    launchSlug &&
    (data.type === "lead" || data.type === "sale" || data.type === "seminar")
  ) {
    const intent: "registro" | "comprador" | "evento" =
      data.type === "sale" ? "comprador" : data.type === "seminar" ? "evento" : "registro";
    syncLeadToAc({
      email: data.email,
      name: data.name,
      launchSlug,
      launchListId: launchAcListId,
      launchTagIds: launchAcTagIds,
      intent,
    }).catch((err) => console.error("AC sync failed", err));
  }

  await db.insert(trackingEvents).values({
    type: data.type,
    sessionId: data.sessionId ?? null,
    visitorCookie: data.cookie ?? null,
    email: data.email ?? null,
    name: data.name ?? null,
    affiliateRef: data.ref ?? null,
    affiliateUserId,
    utmSource: source,
    utmMedium: data.utmMedium ?? null,
    utmCampaign: data.utmCampaign ?? null,
    utmContent: data.utmContent ?? null,
    utmTerm: data.utmTerm ?? null,
    launchId,
    pageId: data.pageId ?? null,
    urlCurrent: data.urlCurrent ?? null,
    urlPrevious: data.urlPrevious ?? null,
    amountCents: data.amountCents ?? null,
    currency: data.currency ?? null,
    product: data.product ?? null,
    stripeSessionId: data.stripeSessionId ?? null,
    ip,
    country: geo.country,
    city: geo.city,
    userAgent: userAgent ?? null,
    payload: data.payload ?? {},
  });

  return NextResponse.json({ ok: true });
}
