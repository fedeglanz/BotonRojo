import { auth } from "./auth";

/**
 * Returns the current user's session ensuring they are authenticated
 * and belong to an organization. Throws if not.
 *
 * Use this in server actions and page loaders to scope all queries
 * by organizationId.
 */
export async function requireOrgAccess() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthorized");

  const orgId = session.user.organizationId;
  if (!orgId) throw new Error("no_organization");

  return {
    userId: session.user.id,
    organizationId: orgId,
    role: session.user.role,
    session,
  };
}

/**
 * Like requireOrgAccess but also checks for admin (or superadmin) role.
 */
export async function requireOrgAdmin() {
  const ctx = await requireOrgAccess();
  if (ctx.role !== "admin" && ctx.role !== "superadmin") throw new Error("unauthorized");
  return ctx;
}

/**
 * Requires the superadmin role (platform owner).
 * Does NOT require organizationId — superadmin sees everything.
 */
export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthorized");
  if (session.user.role !== "superadmin") throw new Error("unauthorized");

  return {
    userId: session.user.id,
    role: session.user.role as "superadmin",
    session,
  };
}
