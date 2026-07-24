"use server";

import { promises as dns } from "node:dns";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { domains, launches } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createId } from "@/lib/ids";
import { env } from "@/lib/env";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "superadmin")) throw new Error("unauthorized");
  return session.user;
}

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?!:\/\/)([a-z0-9-]+\.)+[a-z]{2,}$/, "Dominio no válido");

export async function listDomainsForLaunch(launchId: string) {
  return db.select().from(domains).where(eq(domains.launchId, launchId)).orderBy(domains.createdAt);
}

const addSchema = z.object({
  launchId: z.string().min(1),
  launchSlug: z.string().min(1),
  hostname: hostnameSchema,
});

export async function addDomainAction(formData: FormData) {
  await requireAdmin();
  const parsed = addSchema.parse({
    launchId: formData.get("launchId"),
    launchSlug: formData.get("launchSlug"),
    hostname: formData.get("hostname"),
  });

  const isApex = parsed.hostname.split(".").length === 2;

  await db.insert(domains).values({
    launchId: parsed.launchId,
    hostname: parsed.hostname,
    isApex,
    verificationToken: `botonrojo-verify-${createId(16).toLowerCase()}`,
  });

  revalidatePath(`/admin/lanzamientos/${parsed.launchSlug}`);
}

export async function removeDomainAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const launchSlug = String(formData.get("launchSlug") ?? "");
  if (!id) throw new Error("missing_id");

  await db.delete(domains).where(eq(domains.id, id));
  revalidatePath(`/admin/lanzamientos/${launchSlug}`);
}

/**
 * Confirms the client actually pointed DNS at us before we let Caddy fetch a
 * certificate for this hostname — an apex domain must A-record to SERVER_IPV4,
 * a subdomain must CNAME (directly or transitively) to our own app hostname.
 */
export async function verifyDomainAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const launchSlug = String(formData.get("launchSlug") ?? "");
  if (!id) throw new Error("missing_id");

  const [domain] = await db.select().from(domains).where(eq(domains.id, id)).limit(1);
  if (!domain) throw new Error("domain_not_found");

  const appHostname = new URL(env.APP_URL).hostname;
  let ok = false;
  let error: string | null = null;

  try {
    if (domain.isApex) {
      const addresses = await dns.resolve4(domain.hostname);
      ok = env.SERVER_IPV4 !== "" && addresses.includes(env.SERVER_IPV4);
      if (!ok) error = `El registro A no apunta a ${env.SERVER_IPV4 || "(configura SERVER_IPV4)"}.`;
    } else {
      const chain = await dns.resolveCname(domain.hostname).catch(() => [] as string[]);
      ok = chain.some((target) => target.replace(/\.$/, "") === appHostname);
      if (!ok) error = `El CNAME debe apuntar a ${appHostname}.`;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "No se pudo resolver el dominio.";
  }

  await db
    .update(domains)
    .set({
      status: ok ? "active" : "failed",
      verifiedAt: ok ? new Date() : domain.verifiedAt,
      lastCheckedAt: new Date(),
      lastError: error,
      updatedAt: new Date(),
    })
    .where(eq(domains.id, id));

  revalidatePath(`/admin/lanzamientos/${launchSlug}`);
}

/**
 * Called by Caddy's on-demand TLS `ask` directive before issuing a certificate
 * for a hostname it doesn't already have a static config block for.
 */
export async function isDomainActiveForTls(hostname: string): Promise<boolean> {
  const [domain] = await db
    .select({ status: domains.status })
    .from(domains)
    .where(eq(domains.hostname, hostname.toLowerCase()))
    .limit(1);
  return domain?.status === "active";
}

export async function resolveLaunchByHostname(hostname: string) {
  const [row] = await db
    .select({ launch: launches, domain: domains })
    .from(domains)
    .innerJoin(launches, eq(domains.launchId, launches.id))
    .where(eq(domains.hostname, hostname.toLowerCase()))
    .limit(1);

  if (!row || row.domain.status !== "active") return null;
  return row.launch;
}
