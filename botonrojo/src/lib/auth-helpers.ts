import "server-only";
import { auth } from "@/lib/auth";

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
  return { user: session.user, organizationId };
}

export async function requireOrgMember() {
  const session = await auth();
  if (!session?.user) throw new Error("unauthorized");
  const organizationId = session.user.organizationId;
  if (!organizationId) throw new Error("no_organization");
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
