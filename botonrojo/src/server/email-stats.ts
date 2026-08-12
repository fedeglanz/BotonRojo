"use server";

import { db } from "@/db";
import { launches, assets } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import {
  getActiveCampaignClientForOrg,
  type ACCampaign,
} from "@/integrations/activecampaign";

export type EmailCampaignStat = {
  campaignId: string;
  name: string;
  subject: string;
  status: number; // 0=draft, 1=scheduled, 2=sending, 3=paused, 5=sent
  scheduledDate: string | null;
  sends: number;
  uniqueOpens: number;
  opens: number;
  uniqueClicks: number;
  clicks: number;
  hardBounces: number;
  softBounces: number;
  unsubscribes: number;
  forwards: number;
  replies: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubRate: number;
};

export type LaunchEmailStats = {
  launchId: string;
  launchName: string;
  launchSlug: string;
  campaigns: EmailCampaignStat[];
  totals: {
    sends: number;
    uniqueOpens: number;
    uniqueClicks: number;
    hardBounces: number;
    softBounces: number;
    unsubscribes: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    unsubRate: number;
  };
};

function mapCampaign(c: ACCampaign): EmailCampaignStat {
  return {
    campaignId: c.id,
    name: c.name,
    subject: c.name, // AC name contains subject info from our naming convention
    status: c.status,
    scheduledDate: c.sdate ?? null,
    sends: c.sends ?? 0,
    uniqueOpens: c.uniqueopens ?? 0,
    opens: c.opens ?? 0,
    uniqueClicks: c.uniquelinkclicks ?? 0,
    clicks: c.linkclicks ?? 0,
    hardBounces: c.hardbounces ?? 0,
    softBounces: c.softbounces ?? 0,
    unsubscribes: c.unsubscribes ?? 0,
    forwards: c.forwards ?? 0,
    replies: c.replies ?? 0,
    openRate: c.openRate ?? 0,
    clickRate: c.clickRate ?? 0,
    bounceRate: c.bounceRate ?? 0,
    unsubRate: c.unsubRate ?? 0,
  };
}

function computeTotals(campaigns: EmailCampaignStat[]) {
  const sends = campaigns.reduce((s, c) => s + c.sends, 0);
  const uniqueOpens = campaigns.reduce((s, c) => s + c.uniqueOpens, 0);
  const uniqueClicks = campaigns.reduce((s, c) => s + c.uniqueClicks, 0);
  const hardBounces = campaigns.reduce((s, c) => s + c.hardBounces, 0);
  const softBounces = campaigns.reduce((s, c) => s + c.softBounces, 0);
  const unsubscribes = campaigns.reduce((s, c) => s + c.unsubscribes, 0);
  return {
    sends,
    uniqueOpens,
    uniqueClicks,
    hardBounces,
    softBounces,
    unsubscribes,
    openRate: sends > 0 ? (uniqueOpens / sends) * 100 : 0,
    clickRate: sends > 0 ? (uniqueClicks / sends) * 100 : 0,
    bounceRate: sends > 0 ? ((hardBounces + softBounces) / sends) * 100 : 0,
    unsubRate: sends > 0 ? (unsubscribes / sends) * 100 : 0,
  };
}

/** Fetch email campaign stats for a single launch. */
export async function getEmailStatsForLaunch(launchId: string): Promise<LaunchEmailStats | null> {
  const { organizationId } = await requireOrgAdmin();
  const ac = await getActiveCampaignClientForOrg(organizationId);
  if (!ac) return null;

  const [launch] = await db
    .select({
      id: launches.id,
      name: launches.name,
      slug: launches.slug,
      assetsCache: launches.assetsCache,
    })
    .from(launches)
    .where(and(eq(launches.id, launchId), eq(launches.organizationId, organizationId)))
    .limit(1);

  if (!launch) return null;

  const cache = (launch.assetsCache ?? {}) as Record<string, unknown>;
  const campaignIds = (cache.acCampaignIds as string[]) ?? [];
  if (!campaignIds.length) {
    return {
      launchId: launch.id,
      launchName: launch.name,
      launchSlug: launch.slug,
      campaigns: [],
      totals: computeTotals([]),
    };
  }

  const rawCampaigns = await ac.getCampaignsWithStats(campaignIds);
  const campaigns = rawCampaigns.map(mapCampaign);

  return {
    launchId: launch.id,
    launchName: launch.name,
    launchSlug: launch.slug,
    campaigns,
    totals: computeTotals(campaigns),
  };
}

/** Fetch email campaign stats for all launches in the org. */
export async function getAllEmailStats(): Promise<LaunchEmailStats[]> {
  const { organizationId } = await requireOrgAdmin();
  const ac = await getActiveCampaignClientForOrg(organizationId);
  if (!ac) return [];

  const orgLaunches = await db
    .select({
      id: launches.id,
      name: launches.name,
      slug: launches.slug,
      assetsCache: launches.assetsCache,
    })
    .from(launches)
    .where(eq(launches.organizationId, organizationId))
    .orderBy(desc(launches.createdAt));

  const results: LaunchEmailStats[] = [];

  for (const launch of orgLaunches) {
    const cache = (launch.assetsCache ?? {}) as Record<string, unknown>;
    const campaignIds = (cache.acCampaignIds as string[]) ?? [];
    if (!campaignIds.length) continue;

    const rawCampaigns = await ac.getCampaignsWithStats(campaignIds);
    const campaigns = rawCampaigns.map(mapCampaign);

    results.push({
      launchId: launch.id,
      launchName: launch.name,
      launchSlug: launch.slug,
      campaigns,
      totals: computeTotals(campaigns),
    });
  }

  return results;
}

/** List launches that have AC campaigns for the filter dropdown. */
export async function listLaunchesWithCampaigns() {
  const { organizationId } = await requireOrgAdmin();
  const orgLaunches = await db
    .select({
      id: launches.id,
      slug: launches.slug,
      name: launches.name,
      assetsCache: launches.assetsCache,
    })
    .from(launches)
    .where(eq(launches.organizationId, organizationId))
    .orderBy(desc(launches.createdAt));

  return orgLaunches.filter((l) => {
    const cache = (l.assetsCache ?? {}) as Record<string, unknown>;
    return ((cache.acCampaignIds as string[]) ?? []).length > 0;
  }).map((l) => ({ id: l.id, slug: l.slug, name: l.name }));
}
