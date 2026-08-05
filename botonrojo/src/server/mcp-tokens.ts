"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { mcpTokens } from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { hashToken, hintFor, mintToken } from "@/mcp/auth";

/**
 * Minting a connector token.
 *
 * The token is returned once, in the redirect, and never stored in the clear. That
 * means "I lost it" can only ever be answered with "create another one" — which is
 * the point: a token that can be recovered can be recovered by whoever gets into
 * the panel.
 */
export async function createMcpTokenAction(formData: FormData) {
  const { organizationId, user } = await requireOrgAdmin();
  if (!organizationId) throw new Error("no_organization");

  const label = String(formData.get("label") ?? "").trim() || "Claude";
  const token = mintToken();

  await db.insert(mcpTokens).values({
    organizationId,
    label,
    tokenHash: hashToken(token),
    tokenHint: hintFor(token),
    createdById: user.id,
  });

  revalidatePath("/admin/conexion-claude");
  return token;
}

export async function revokeMcpTokenAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  if (!organizationId) throw new Error("no_organization");

  const id = String(formData.get("id") ?? "");
  await db
    .update(mcpTokens)
    // Revoked, not deleted: the row is the record of what was connected and when,
    // and it's the only way to answer "was this in use?" after the fact.
    .set({ revokedAt: new Date() })
    .where(
      and(eq(mcpTokens.id, id), eq(mcpTokens.organizationId, organizationId)),
    );

  revalidatePath("/admin/conexion-claude");
}
