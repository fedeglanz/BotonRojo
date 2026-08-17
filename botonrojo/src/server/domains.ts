"use server";

import { promises as dns } from "node:dns";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { domains, launches } from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { createId } from "@/lib/ids";
import { env } from "@/lib/env";

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?!:\/\/)([a-z0-9-]+\.)+[a-z]{2,}$/, "Dominio no válido");

/** Verifies the launch belongs to the acting admin's organization before touching its domains. */
async function getOrgLaunchId(launchId: string, organizationId: string) {
  const [launch] = await db
    .select({ id: launches.id })
    .from(launches)
    .where(
      and(
        eq(launches.id, launchId),
        eq(launches.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!launch) throw new Error("launch_not_found");
  return launch.id;
}

export async function listDomainsForLaunch(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  await getOrgLaunchId(launchId, organizationId);
  return db
    .select()
    .from(domains)
    .where(eq(domains.launchId, launchId))
    .orderBy(domains.createdAt);
}

const addSchema = z.object({
  launchId: z.string().min(1),
  launchSlug: z.string().min(1),
  hostname: hostnameSchema,
});

export async function addDomainAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const parsed = addSchema.parse({
    launchId: formData.get("launchId"),
    launchSlug: formData.get("launchSlug"),
    hostname: formData.get("hostname"),
  });
  await getOrgLaunchId(parsed.launchId, organizationId);

  const isApex = parsed.hostname.split(".").length === 2;

  await db.insert(domains).values({
    organizationId,
    launchId: parsed.launchId,
    hostname: parsed.hostname,
    isApex,
    verificationToken: `botonrojo-verify-${createId(16).toLowerCase()}`,
  });

  revalidatePath(`/admin/lanzamientos/${parsed.launchSlug}`);
}

export async function removeDomainAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const id = String(formData.get("id") ?? "");
  const launchSlug = String(formData.get("launchSlug") ?? "");
  if (!id) throw new Error("missing_id");

  await db
    .delete(domains)
    .where(and(eq(domains.id, id), eq(domains.organizationId, organizationId)));
  revalidatePath(`/admin/lanzamientos/${launchSlug}`);
}

/**
 * Confirms the client actually pointed DNS at us before we let Caddy fetch a
 * certificate for this hostname — an apex domain must A-record to SERVER_IPV4,
 * a subdomain must CNAME (directly or transitively) to our own app hostname.
 */
export async function verifyDomainAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const id = String(formData.get("id") ?? "");
  const launchSlug = String(formData.get("launchSlug") ?? "");
  if (!id) throw new Error("missing_id");

  const [domain] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.id, id), eq(domains.organizationId, organizationId)))
    .limit(1);
  if (!domain) throw new Error("domain_not_found");

  const appHostname = new URL(env.APP_URL).hostname;
  let ok = false;
  let error: string | null = null;

  /**
   * Vale cualquiera de las dos: A a nuestra IP o CNAME a nuestro dominio.
   *
   * Antes se exigía A en los dominios raíz y CNAME en los subdominios, y eso no
   * describe la realidad: al servidor le da igual cómo se haya resuelto el nombre, y
   * hay proveedores —y departamentos de IT -- que solo saben dar de alta un registro A
   * y te piden la IP. Rechazar una configuración que funciona es decirle a alguien que
   * lo ha hecho mal cuando lo ha hecho bien.
   */
  try {
    const [addresses, chain] = await Promise.all([
      dns.resolve4(domain.hostname).catch(() => [] as string[]),
      dns.resolveCname(domain.hostname).catch(() => [] as string[]),
    ]);

    const apuntaPorA =
      env.SERVER_IPV4 !== "" && addresses.includes(env.SERVER_IPV4);
    const apuntaPorCname = chain.some(
      (target) => target.replace(/\.$/, "") === appHostname,
    );
    ok = apuntaPorA || apuntaPorCname;

    if (!ok) {
      error =
        addresses.length || chain.length
          ? `Ese nombre resuelve a ${[...addresses, ...chain].join(", ")}. Tiene que ser un registro A a ${env.SERVER_IPV4 || "(configura SERVER_IPV4)"} o un CNAME a ${appHostname}.`
          : `Ese nombre todavía no resuelve a nada. Los DNS tardan un rato en propagarse; si acabas de crearlo, espera unos minutos.`;
    }
  } catch (err) {
    error =
      err instanceof Error ? err.message : "No se pudo resolver el dominio.";
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
 * for a hostname it doesn't already have a static config block for. Hostnames
 * are globally unique (see `domains.hostname`), so no organization scoping applies.
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
