"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and, sql, desc } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { users, trackingEvents, affiliateLinks, affiliatePayouts, launches, organizations } from "@/db/schema";
import { auth, hashPassword, signIn } from "@/lib/auth";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { createAffiliateCode, createId } from "@/lib/ids";


// ---------- Helpers ----------

async function requireAffiliateOrAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthorized");
  if (!["affiliate", "admin", "superadmin"].includes(session.user.role)) throw new Error("forbidden");
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("no_organization");
  return { user: session.user, organizationId };
}

// ---------- Stats ----------

export type AffiliateOverview = {
  user: typeof users.$inferSelect;
  visits: number;
  leads: number;
  sales: number;
  salesAmountCents: number;
  commissionCents: number;
  paidCents: number;
  balanceCents: number;
  leadConversion: number;
  saleConversion: number;
};

export type LaunchBreakdown = {
  launchId: string;
  launchName: string;
  launchSlug: string;
  visits: number;
  leads: number;
  sales: number;
  salesAmountCents: number;
};

/** userId must already be known to belong to the caller's organization (see callers below). */
async function getAffiliateOverview(userId: string): Promise<AffiliateOverview | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const eventStats = await db
    .select({
      type: trackingEvents.type,
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${trackingEvents.amountCents}), 0)::int`,
    })
    .from(trackingEvents)
    .where(eq(trackingEvents.affiliateUserId, userId))
    .groupBy(trackingEvents.type);

  let visits = 0;
  let leads = 0;
  let sales = 0;
  let salesAmountCents = 0;

  for (const row of eventStats) {
    if (row.type === "visit") visits = row.count;
    if (row.type === "lead") leads = row.count;
    if (row.type === "sale") {
      sales = row.count;
      salesAmountCents = row.total;
    }
  }

  const rateBps = user.affiliateCommissionRate ?? 3000;
  const commissionCents = Math.floor((salesAmountCents * rateBps) / 10000);

  const [payouts] = await db
    .select({ total: sql<number>`coalesce(sum(${affiliatePayouts.amountCents}), 0)::int` })
    .from(affiliatePayouts)
    .where(eq(affiliatePayouts.userId, userId));

  const paidCents = payouts?.total ?? 0;

  return {
    user,
    visits,
    leads,
    sales,
    salesAmountCents,
    commissionCents,
    paidCents,
    balanceCents: commissionCents - paidCents,
    leadConversion: visits > 0 ? (leads / visits) * 100 : 0,
    saleConversion: leads > 0 ? (sales / leads) * 100 : 0,
  };
}

/** Admin viewing an arbitrary affiliate — verifies they belong to the acting admin's organization first. */
export async function getAffiliateOverviewForAdmin(userId: string): Promise<AffiliateOverview | null> {
  const { organizationId } = await requireOrgAdmin();
  const [affiliate] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.organizationId, organizationId), eq(users.role, "affiliate")))
    .limit(1);
  if (!affiliate) return null;
  return getAffiliateOverview(userId);
}

/** An affiliate viewing their own dashboard — no cross-tenant risk, it's always their own row. */
export async function getMyAffiliateOverview(): Promise<AffiliateOverview | null> {
  const { user } = await requireAffiliateOrAdmin();
  return getAffiliateOverview(user.id);
}

export async function getAffiliateLaunchBreakdown(userId: string): Promise<LaunchBreakdown[]> {
  const rows = await db
    .select({
      launchId: trackingEvents.launchId,
      launchName: launches.name,
      launchSlug: launches.slug,
      type: trackingEvents.type,
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(${trackingEvents.amountCents}), 0)::int`,
    })
    .from(trackingEvents)
    .innerJoin(launches, eq(trackingEvents.launchId, launches.id))
    .where(eq(trackingEvents.affiliateUserId, userId))
    .groupBy(trackingEvents.launchId, launches.name, launches.slug, trackingEvents.type);

  const byLaunch = new Map<string, LaunchBreakdown>();
  for (const row of rows) {
    if (!row.launchId) continue;
    const cur = byLaunch.get(row.launchId) ?? {
      launchId: row.launchId,
      launchName: row.launchName,
      launchSlug: row.launchSlug,
      visits: 0,
      leads: 0,
      sales: 0,
      salesAmountCents: 0,
    };
    if (row.type === "visit") cur.visits = row.count;
    if (row.type === "lead") cur.leads = row.count;
    if (row.type === "sale") {
      cur.sales = row.count;
      cur.salesAmountCents = row.total;
    }
    byLaunch.set(row.launchId, cur);
  }

  return Array.from(byLaunch.values()).sort((a, b) => b.salesAmountCents - a.salesAmountCents);
}

export async function getAllAffiliatesOverview(): Promise<AffiliateOverview[]> {
  const { organizationId } = await requireOrgAdmin();
  const list = await db
    .select()
    .from(users)
    .where(and(eq(users.role, "affiliate"), eq(users.organizationId, organizationId)));
  const out: AffiliateOverview[] = [];
  for (const u of list) {
    const o = await getAffiliateOverview(u.id);
    if (o) out.push(o);
  }
  return out.sort((a, b) => b.salesAmountCents - a.salesAmountCents);
}

// ---------- Actions ----------

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  organizationSlug: z.string().min(1),
});

export async function registerAffiliateAction(formData: FormData) {
  const parsed = registerSchema.parse({
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").toLowerCase().trim(),
    password: formData.get("password"),
    organizationSlug: formData.get("organizationSlug"),
  });

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, parsed.organizationSlug))
    .limit(1);
  if (!org) throw new Error("organization_not_found");

  const [existing] = await db.select().from(users).where(eq(users.email, parsed.email)).limit(1);
  if (existing) throw new Error("email_already_used");

  const passwordHash = await hashPassword(parsed.password);

  let affiliateCode = createAffiliateCode();
  for (let i = 0; i < 3; i++) {
    const [clash] = await db
      .select()
      .from(users)
      .where(eq(users.affiliateCode, affiliateCode))
      .limit(1);
    if (!clash) break;
    affiliateCode = createAffiliateCode();
  }

  await db.insert(users).values({
    organizationId: org.id,
    email: parsed.email,
    name: parsed.name,
    passwordHash,
    role: "affiliate",
    affiliateCode,
    affiliateCommissionRate: 3000,
  });

  await signIn("credentials", {
    email: parsed.email,
    password: parsed.password,
    redirectTo: "/afiliado",
  });
}

const adminCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  commissionPercent: z.coerce.number().min(0).max(100).default(30),
});

export async function adminCreateAffiliateAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();

  const parsed = adminCreateSchema.parse({
    name: formData.get("name"),
    email: String(formData.get("email") ?? "").toLowerCase().trim(),
    password: formData.get("password"),
    commissionPercent: formData.get("commissionPercent"),
  });

  const [existing] = await db.select().from(users).where(eq(users.email, parsed.email)).limit(1);
  if (existing) throw new Error("email_already_used");

  const passwordHash = await hashPassword(parsed.password);
  const affiliateCode = createAffiliateCode();

  const [created] = await db
    .insert(users)
    .values({
      organizationId,
      email: parsed.email,
      name: parsed.name,
      passwordHash,
      role: "affiliate",
      affiliateCode,
      affiliateCommissionRate: Math.round(parsed.commissionPercent * 100),
    })
    .returning({ id: users.id });

  revalidatePath("/admin/afiliados");
  if (created) redirect(`/admin/afiliados/${created.id}`);
}

const setRateSchema = z.object({
  userId: z.string().min(1),
  commissionPercent: z.coerce.number().min(0).max(100),
});

export async function setCommissionRateAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const parsed = setRateSchema.parse({
    userId: formData.get("userId"),
    commissionPercent: formData.get("commissionPercent"),
  });

  await db
    .update(users)
    .set({ affiliateCommissionRate: Math.round(parsed.commissionPercent * 100), updatedAt: new Date() })
    .where(and(eq(users.id, parsed.userId), eq(users.organizationId, organizationId)));

  revalidatePath(`/admin/afiliados/${parsed.userId}`);
}

const payoutSchema = z.object({
  userId: z.string().min(1),
  amountCents: z.coerce.number().int().min(1),
  reference: z.string().optional(),
  notes: z.string().optional(),
  launchId: z.string().optional(),
});

export async function recordPayoutAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const parsed = payoutSchema.parse({
    userId: formData.get("userId"),
    amountCents: formData.get("amountCents"),
    reference: formData.get("reference") || undefined,
    notes: formData.get("notes") || undefined,
    launchId: formData.get("launchId") || undefined,
  });

  // The affiliate must belong to this organization — otherwise silently no-op via the where clause below.
  const [affiliate] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, parsed.userId), eq(users.organizationId, organizationId)))
    .limit(1);
  if (!affiliate) throw new Error("affiliate_not_found");

  await db.insert(affiliatePayouts).values({
    organizationId,
    userId: parsed.userId,
    amountCents: parsed.amountCents,
    reference: parsed.reference,
    notes: parsed.notes,
    launchId: parsed.launchId || null,
    currency: "EUR",
  });

  revalidatePath(`/admin/afiliados/${parsed.userId}`);
}

const linkSchema = z.object({
  launchSlug: z.string().min(1),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
});

export async function createAffiliateLinkAction(formData: FormData) {
  const { user, organizationId } = await requireAffiliateOrAdmin();
  const parsed = linkSchema.parse({
    launchSlug: formData.get("launchSlug"),
    utmSource: formData.get("utmSource") || undefined,
    utmMedium: formData.get("utmMedium") || undefined,
    utmCampaign: formData.get("utmCampaign") || undefined,
    utmContent: formData.get("utmContent") || undefined,
  });

  const [launch] = await db
    .select()
    .from(launches)
    .where(and(eq(launches.slug, parsed.launchSlug), eq(launches.organizationId, organizationId)))
    .limit(1);
  if (!launch) throw new Error("launch_not_found");

  const [dbUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!dbUser?.affiliateCode) throw new Error("affiliate_code_missing");

  const params = new URLSearchParams({ ref: dbUser.affiliateCode });
  if (parsed.utmSource) params.set("utm_source", parsed.utmSource);
  if (parsed.utmMedium) params.set("utm_medium", parsed.utmMedium);
  if (parsed.utmCampaign) params.set("utm_campaign", parsed.utmCampaign);
  if (parsed.utmContent) params.set("utm_content", parsed.utmContent);

  await db.insert(affiliateLinks).values({
    organizationId,
    userId: user.id,
    launchId: launch.id,
    slug: `${dbUser.affiliateCode}-${createId(6)}`,
    destinationUrl: `/${launch.slug}?${params.toString()}`,
    utmSource: parsed.utmSource,
    utmMedium: parsed.utmMedium,
    utmCampaign: parsed.utmCampaign,
    utmContent: parsed.utmContent,
  });

  revalidatePath("/afiliado/enlaces");
}

export async function listAffiliateLinks(userId: string) {
  return db
    .select({
      id: affiliateLinks.id,
      slug: affiliateLinks.slug,
      destinationUrl: affiliateLinks.destinationUrl,
      utmSource: affiliateLinks.utmSource,
      utmMedium: affiliateLinks.utmMedium,
      utmCampaign: affiliateLinks.utmCampaign,
      utmContent: affiliateLinks.utmContent,
      launchSlug: launches.slug,
      launchName: launches.name,
      createdAt: affiliateLinks.createdAt,
    })
    .from(affiliateLinks)
    .leftJoin(launches, eq(affiliateLinks.launchId, launches.id))
    .where(eq(affiliateLinks.userId, userId))
    .orderBy(desc(affiliateLinks.createdAt));
}

export async function listPayouts(userId: string) {
  return db
    .select({
      id: affiliatePayouts.id,
      amountCents: affiliatePayouts.amountCents,
      currency: affiliatePayouts.currency,
      reference: affiliatePayouts.reference,
      notes: affiliatePayouts.notes,
      paidAt: affiliatePayouts.paidAt,
      launchSlug: launches.slug,
      launchName: launches.name,
    })
    .from(affiliatePayouts)
    .leftJoin(launches, eq(affiliatePayouts.launchId, launches.id))
    .where(eq(affiliatePayouts.userId, userId))
    .orderBy(desc(affiliatePayouts.paidAt));
}

export async function getAffiliateByIdOrEmail(idOrEmail: string) {
  const { organizationId } = await requireOrgAdmin();
  const [byId] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, idOrEmail), eq(users.role, "affiliate"), eq(users.organizationId, organizationId)))
    .limit(1);
  if (byId) return byId;
  const [byEmail] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.email, idOrEmail.toLowerCase()),
        eq(users.role, "affiliate"),
        eq(users.organizationId, organizationId),
      ),
    )
    .limit(1);
  return byEmail ?? null;
}
