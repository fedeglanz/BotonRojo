import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { organizations } from "./organizations";
import { users } from "./users";

/**
 * Credentials for the MCP connector — how Claude reaches one organization's
 * launches.
 *
 * Only a hash is stored: the token is shown once, when it's minted, and after
 * that nobody (us included) can read it back. A leaked token would let anyone
 * publish pages on that client's domain, so "recover my token" must be
 * impossible by construction rather than by policy.
 *
 * Scoped to an organization, never to a user: the connector belongs to the
 * client's account, and revoking someone's access shouldn't silently break their
 * team's pages.
 */
export const mcpTokens = pgTable(
  "mcp_tokens",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Whose Claude this is, so a list of tokens is readable. */
    label: text("label").notNull(),
    /** SHA-256 of the token. */
    tokenHash: text("token_hash").notNull(),
    /** First and last characters, to tell rows apart in the panel. */
    tokenHint: text("token_hint").notNull(),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }),
    revokedAt: timestamp("revoked_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    // Every MCP request looks a token up by its hash, so this is the hot path.
    index("mcp_tokens_hash_idx").on(table.tokenHash),
  ],
);

export type McpToken = typeof mcpTokens.$inferSelect;
