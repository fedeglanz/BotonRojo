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
 * Like requireOrgAccess but also checks for admin role.
 */
export async function requireOrgAdmin() {
  const ctx = await requireOrgAccess();
  if (ctx.role !== "admin") throw new Error("unauthorized");
  return ctx;
}
