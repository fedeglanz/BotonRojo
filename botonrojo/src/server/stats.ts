"use server";

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { trackingEvents, launches, adSpend, users, externalSalesSources } from "@/db/schema";
import { auth } from "@/lib/auth";
import { queryExternalSalesSummary } from "@/server/external-sales";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") throw new Error("unauthorized");
  return session.user;
}

export type StatsFilters = {
  launchId?: string;
  from: Date;
  to: Date;
};

function filterConditions(f: StatsFilters) {
  const conds = [gte(trackingEvents.occurredAt, f.from), lte(trackingEvents.occurredAt, f.to)];
  if (f.launchId) conds.push(eq(trackingEvents.launchId, f.launchId));
  return and(...conds);
}

export async function listLaunchesForFilter() {
  await requireAdmin();
  return db
    .select({ id: launches.id, slug: launches.slug, name: launches.name })
    .from(launches)
    .orderBy(desc(launches.createdAt));
}

export type FunnelSummary = {
  visits: number;
  leads: number;
  sales: number;
  revenueCents: number;
  leadConversion: number;
  saleConversion: number;
};

export async function getFunnelSummary(f: StatsFilters): Promise<FunnelSummary> {
  await requireAdmin();
  const rows = await db
    .select({
      type: trackingEvents.type,
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${trackingEvents.amountCents}), 0)::int`,
    })
    .from(trackingEvents)
    .where(filterConditions(f))
    .groupBy(trackingEvents.type);

  let visits = 0;
  let leads = 0;
  let sales = 0;
  let revenueCents = 0;
  for (const r of rows) {
    if (r.type === "visit") visits = r.count;
    if (r.type === "lead" || r.type === "seminar") leads += r.count;
    if (r.type === "sale") {
      sales = r.count;
      revenueCents = r.revenue;
    }
  }

  return {
    visits,
    leads,
    sales,
    revenueCents,
    leadConversion: visits > 0 ? (leads / visits) * 100 : 0,
    saleConversion: leads > 0 ? (sales / leads) * 100 : 0,
  };
}

export type BreakdownRow = {
  key: string;
  visits: number;
  leads: number;
  sales: number;
  revenueCents: number;
};

const DIMENSION_COLUMN = {
  source: trackingEvents.utmSource,
  medium: trackingEvents.utmMedium,
  campaign: trackingEvents.utmCampaign,
  country: trackingEvents.country,
} as const;

export type BreakdownDimension = keyof typeof DIMENSION_COLUMN;

export async function getBreakdown(
  dimension: BreakdownDimension,
  f: StatsFilters,
): Promise<BreakdownRow[]> {
  await requireAdmin();
  const col = DIMENSION_COLUMN[dimension];
  const keyExpr = sql<string>`coalesce(${col}, 'directo')`;

  const rows = await db
    .select({
      key: keyExpr,
      type: trackingEvents.type,
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${trackingEvents.amountCents}), 0)::int`,
    })
    .from(trackingEvents)
    .where(filterConditions(f))
    .groupBy(keyExpr, trackingEvents.type);

  const byKey = new Map<string, BreakdownRow>();
  for (const r of rows) {
    const cur = byKey.get(r.key) ?? { key: r.key, visits: 0, leads: 0, sales: 0, revenueCents: 0 };
    if (r.type === "visit") cur.visits += r.count;
    if (r.type === "lead" || r.type === "seminar") cur.leads += r.count;
    if (r.type === "sale") {
      cur.sales += r.count;
      cur.revenueCents += r.revenue;
    }
    byKey.set(r.key, cur);
  }

  return Array.from(byKey.values()).sort((a, b) => b.visits - a.visits).slice(0, 12);
}

export type AffiliateBreakdownRow = {
  affiliateId: string;
  name: string;
  visits: number;
  leads: number;
  sales: number;
  revenueCents: number;
};

export async function getAffiliateBreakdown(f: StatsFilters): Promise<AffiliateBreakdownRow[]> {
  await requireAdmin();
  const conds = [filterConditions(f), sql`${trackingEvents.affiliateUserId} is not null`];

  const rows = await db
    .select({
      affiliateId: trackingEvents.affiliateUserId,
      name: users.name,
      email: users.email,
      type: trackingEvents.type,
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${trackingEvents.amountCents}), 0)::int`,
    })
    .from(trackingEvents)
    .innerJoin(users, eq(trackingEvents.affiliateUserId, users.id))
    .where(and(...conds))
    .groupBy(trackingEvents.affiliateUserId, users.name, users.email, trackingEvents.type);

  const byAffiliate = new Map<string, AffiliateBreakdownRow>();
  for (const r of rows) {
    if (!r.affiliateId) continue;
    const cur = byAffiliate.get(r.affiliateId) ?? {
      affiliateId: r.affiliateId,
      name: r.name ?? r.email ?? r.affiliateId,
      visits: 0,
      leads: 0,
      sales: 0,
      revenueCents: 0,
    };
    if (r.type === "visit") cur.visits += r.count;
    if (r.type === "lead" || r.type === "seminar") cur.leads += r.count;
    if (r.type === "sale") {
      cur.sales += r.count;
      cur.revenueCents += r.revenue;
    }
    byAffiliate.set(r.affiliateId, cur);
  }

  return Array.from(byAffiliate.values()).sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 10);
}

export type DailyPoint = {
  date: string;
  visits: number;
  leads: number;
  sales: number;
  revenueCents: number;
};

export async function getTimeSeries(f: StatsFilters): Promise<DailyPoint[]> {
  await requireAdmin();
  const dayExpr = sql<string>`to_char(date_trunc('day', ${trackingEvents.occurredAt}), 'YYYY-MM-DD')`;

  const rows = await db
    .select({
      day: dayExpr,
      type: trackingEvents.type,
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${trackingEvents.amountCents}), 0)::int`,
    })
    .from(trackingEvents)
    .where(filterConditions(f))
    .groupBy(dayExpr, trackingEvents.type)
    .orderBy(dayExpr);

  const byDay = new Map<string, DailyPoint>();
  for (const r of rows) {
    const cur = byDay.get(r.day) ?? { date: r.day, visits: 0, leads: 0, sales: 0, revenueCents: 0 };
    if (r.type === "visit") cur.visits += r.count;
    if (r.type === "lead" || r.type === "seminar") cur.leads += r.count;
    if (r.type === "sale") {
      cur.sales += r.count;
      cur.revenueCents += r.revenue;
    }
    byDay.set(r.day, cur);
  }

  return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export type AdSpendSummary = {
  spendCents: number;
  byChannel: { channel: string; spendCents: number }[];
  cplCents: number | null;
  roas: number | null;
};

export async function getAdSpendSummary(f: StatsFilters): Promise<AdSpendSummary> {
  await requireAdmin();
  const conds = [gte(adSpend.spendDate, f.from), lte(adSpend.spendDate, f.to)];
  if (f.launchId) conds.push(eq(adSpend.launchId, f.launchId));

  const rows = await db
    .select({
      channel: adSpend.channel,
      spend: sql<number>`coalesce(sum(${adSpend.amountCents}), 0)::int`,
    })
    .from(adSpend)
    .where(and(...conds))
    .groupBy(adSpend.channel);

  const spendCents = rows.reduce((acc, r) => acc + r.spend, 0);
  const funnel = await getFunnelSummary(f);

  return {
    spendCents,
    byChannel: rows.map((r) => ({ channel: r.channel, spendCents: r.spend })),
    cplCents: spendCents > 0 && funnel.leads > 0 ? Math.round(spendCents / funnel.leads) : null,
    roas: spendCents > 0 ? funnel.revenueCents / spendCents : null,
  };
}

const addSpendSchema = z.object({
  launchId: z.string().min(1),
  channel: z.enum(["meta", "google", "other"]),
  spendDate: z.coerce.date(),
  amountCents: z.coerce.number().int().min(1),
  notes: z.string().optional(),
});

export async function addAdSpendAction(formData: FormData) {
  await requireAdmin();
  const parsed = addSpendSchema.parse({
    launchId: formData.get("launchId"),
    channel: formData.get("channel"),
    spendDate: formData.get("spendDate"),
    amountCents: Math.round(Number(formData.get("amountEuros")) * 100),
    notes: formData.get("notes") || undefined,
  });

  await db.insert(adSpend).values(parsed);
  revalidatePath("/admin/estadisticas");
}

export type ExternalSalesRow = {
  sourceId: string;
  label: string;
  configured: boolean;
  count: number;
  revenueCents: number;
};

export async function getExternalSalesForRange(f: StatsFilters): Promise<ExternalSalesRow[]> {
  await requireAdmin();
  const conds = f.launchId ? eq(externalSalesSources.launchId, f.launchId) : undefined;
  const sources = conds
    ? await db.select().from(externalSalesSources).where(conds)
    : await db.select().from(externalSalesSources);

  const out: ExternalSalesRow[] = [];
  for (const source of sources) {
    const configured = Boolean(source.salesTableHint && source.amountColumn);
    if (!configured) {
      out.push({ sourceId: source.id, label: source.label, configured: false, count: 0, revenueCents: 0 });
      continue;
    }
    try {
      const summary = await queryExternalSalesSummary(source, { from: f.from, to: f.to });
      out.push({
        sourceId: source.id,
        label: source.label,
        configured: true,
        count: summary?.count ?? 0,
        revenueCents: summary?.revenueCents ?? 0,
      });
    } catch {
      out.push({ sourceId: source.id, label: source.label, configured: true, count: 0, revenueCents: 0 });
    }
  }
  return out;
}

export async function listRecentAdSpend(f: StatsFilters) {
  await requireAdmin();
  const conds = [gte(adSpend.spendDate, f.from), lte(adSpend.spendDate, f.to)];
  if (f.launchId) conds.push(eq(adSpend.launchId, f.launchId));

  return db
    .select({
      id: adSpend.id,
      channel: adSpend.channel,
      spendDate: adSpend.spendDate,
      amountCents: adSpend.amountCents,
      notes: adSpend.notes,
      launchName: launches.name,
    })
    .from(adSpend)
    .innerJoin(launches, eq(adSpend.launchId, launches.id))
    .where(and(...conds))
    .orderBy(desc(adSpend.spendDate))
    .limit(20);
}
