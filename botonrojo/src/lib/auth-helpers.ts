import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * The session is a JWT that lives for weeks and carries the user id and the
 * organization id *inside it*. Nothing re-checks them against the database, so a
 * token can outlive what it points at:
 *
 * - the row is gone (a recreated database, a deleted user), and every write then
 *   fails on a foreign key — `assets_author_id_users_id_fk` and friends, which
 *   surface far from the cause and mean nothing to whoever is looking;
 * - the user has been moved to another organization, and the stale token would
 *   keep writing into the previous tenant.
 *
 * One indexed lookup per call closes both. On a mismatch we send them to the
 * login rather than throwing: re-authenticating is exactly what fixes it.
 */
async function assertSessionStillValid(userId: string, organizationId: string) {
  const [row] = await db
    .select({ organizationId: users.organizationId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Through the route handler, not straight to the login: it deletes the dead
  // cookie on the way. Redirecting to the login directly left it in place, so the
  // next navigation bounced back here and the message looked like a login that
  // hadn't worked.
  if (!row || row.organizationId !== organizationId) redirect("/sesion-caducada");
}

/**
 * Every org-scoped server action needs both the acting admin AND their
 * organizationId to scope its queries — returning both here means call sites
 * never have to re-fetch the session just to get the tenant boundary.
 */
export async function requireOrgAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "admin" && session.user.role !== "superadmin")) {
    throw new Error("unauthorized");
  }
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("no_organization");

  await assertSessionStillValid(session.user.id, organizationId);

  return { user: session.user, organizationId };
}

export async function requireOrgMember() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthorized");
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("no_organization");

  await assertSessionStillValid(session.user.id, organizationId);

  return { user: session.user, organizationId };
}

/** Platform-level (you, not a client) — bypasses organization scoping entirely. */
export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || (session.user.role !== "superadmin" && !session.user.isSuperAdmin)) {
    throw new Error("unauthorized");
  }
  return { user: session.user };
}
