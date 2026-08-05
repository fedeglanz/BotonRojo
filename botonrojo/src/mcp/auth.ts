import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { mcpTokens, organizations } from "@/db/schema";
import type { Organization } from "@/db/schema/organizations";

const PREFIX = "br_mcp_";

/** The token is 32 random bytes in base64url — long enough that guessing is not a
 *  threat model, prefixed so a leaked string is recognisable in a log. */
export function mintToken(): string {
  return PREFIX + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** `br_mcp_abcd…wxyz`, for telling rows apart without storing the token. */
export function hintFor(token: string): string {
  const body = token.slice(PREFIX.length);
  return `${PREFIX}${body.slice(0, 4)}…${body.slice(-4)}`;
}

export type McpAuth = {
  organization: Organization;
  tokenId: string;
};

/**
 * Resolves a token to its organization, or null.
 *
 * The lookup is by hash, so a database dump doesn't hand over anyone's connector.
 * The final comparison is constant-time: two hex strings of equal length compared
 * with `===` leak their common prefix through timing, which over enough requests is
 * a way to walk a hash out of the server.
 */
export async function authenticate(
  rawToken: string | null | undefined,
): Promise<McpAuth | null> {
  const token = rawToken?.trim();
  if (!token || !token.startsWith(PREFIX)) return null;

  const hash = hashToken(token);
  const rows = await db
    .select()
    .from(mcpTokens)
    .where(and(eq(mcpTokens.tokenHash, hash), isNull(mcpTokens.revokedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const a = Buffer.from(row.tokenHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, row.organizationId))
    .limit(1);
  if (!organization) return null;

  // Best-effort: the panel shows it so somebody can tell a live connector from an
  // abandoned one. Never worth failing a request over.
  void db
    .update(mcpTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(mcpTokens.id, row.id))
    .catch(() => {});

  return { organization, tokenId: row.id };
}

/**
 * Where the token can travel.
 *
 * `Authorization: Bearer` is the right way and what Claude Code sends. The path
 * form exists because some connector UIs only take a URL — the token is then in
 * the URL, which is worse (it lands in logs and history), so it's second and the
 * docs say so.
 */
export function tokenFromRequest(
  req: Request,
  pathToken?: string,
): string | null {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer "))
    return header.slice(7).trim();
  if (pathToken) return pathToken;
  return new URL(req.url).searchParams.get("token");
}

/** Whether this organization may publish its own HTML — see docs/mcp-claude-design.md. */
export function canPublishCustomPages(organization: Organization): boolean {
  return organization.plan === "pro" || organization.plan === "enterprise";
}

export async function listTokens(organizationId: string) {
  return db
    .select()
    .from(mcpTokens)
    .where(eq(mcpTokens.organizationId, organizationId))
    .orderBy(desc(mcpTokens.createdAt));
}
