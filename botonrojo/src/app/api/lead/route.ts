import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { launches, trackingEvents, users } from "@/db/schema";
import { getClientIp, classifySource } from "@/lib/tracking";
import { getActiveCampaignClientForOrg } from "@/integrations/activecampaign";
import { sendAutomatedTelegramMessage } from "@/server/launches";
import { altaTagKey } from "@/lib/ac-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lead capture over HTTP.
 *
 * The React pages capture leads through a server action, which a hosted HTML page
 * can't call — it isn't part of our component tree. Same work, same table, same
 * affiliate resolution, reachable with a plain fetch.
 */
const schema = z.object({
  launchSlug: z.string().min(1),
  email: z.string().email(),
  name: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  ref: z.string().max(100).nullish(),
  utm: z.record(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }
  const data = parsed.data;
  const email = data.email.toLowerCase().trim();

  const [launch] = await db
    .select()
    .from(launches)
    .where(eq(launches.slug, data.launchSlug))
    .limit(1);
  if (!launch) {
    return NextResponse.json({ error: "launch_not_found" }, { status: 404 });
  }

  const ref = data.ref?.trim() || undefined;
  let affiliateUserId: string | null = null;
  if (ref) {
    const [affiliate] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.affiliateCode, ref),
          eq(users.organizationId, launch.organizationId),
        ),
      )
      .limit(1);
    if (affiliate) affiliateUserId = affiliate.id;
  }

  const utm = data.utm ?? {};

  await db.insert(trackingEvents).values({
    organizationId: launch.organizationId,
    launchId: launch.id,
    type: "lead",
    email,
    name: data.name ?? null,
    affiliateRef: ref ?? null,
    affiliateUserId,
    utmSource: classifySource(utm.utm_source, ref),
    utmMedium: utm.utm_medium ?? null,
    utmCampaign: utm.utm_campaign ?? null,
    utmContent: utm.utm_content ?? null,
    utmTerm: utm.utm_term ?? null,
    ip: getClientIp(req.headers),
    userAgent: req.headers.get("user-agent") ?? null,
    payload: { phone: data.phone ?? null, from: "custom_page" },
  });

  // Same follow-up as the React form's action, so a lead from a hosted page lands
  // in the same list with the same tags. Fire-and-forget: a slow CRM must not make
  // the visitor wait, and a broken CRM must not lose the lead we already stored.
  const ac = await getActiveCampaignClientForOrg(launch.organizationId).catch(
    () => null,
  );
  ac?.syncLeadToAc({
    email,
    name: data.name,
    launchSlug: launch.slug,
    launchListId: launch.activeCampaignListId ?? null,
    launchTagIds: (launch.activeCampaignTagIds ?? {}) as Record<string, number>,
    automationIds: ((launch.assetsCache as Record<string, unknown>)?.acLinkedAutomationIds as string[]) ?? [],
    intent: altaTagKey(launch.type),
  }).catch((err) => console.error("AC sync (custom page lead) failed", err));

  if (launch.telegramChatId) {
    sendAutomatedTelegramMessage({
      chatId: launch.telegramChatId,
      launchId: launch.id,
      organizationId: launch.organizationId,
      event: "on_lead",
      leadName: data.name,
      email,
    }).catch((err) =>
      console.error("Telegram on_lead (custom page) failed", err),
    );
  }

  return NextResponse.json({ ok: true });
}
