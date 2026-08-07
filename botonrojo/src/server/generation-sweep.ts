import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { launches } from "@/db/schema";

/**
 * Closes generation runs left open by a process that no longer exists.
 *
 * Called once at startup — see `src/instrumentation.ts` for why that makes the
 * answer certain instead of a guess.
 *
 * Written as one UPDATE rather than read-modify-write per launch: it runs while the
 * server is booting, and a launch whose record is being rewritten at the same time
 * by a fresh run would otherwise get its progress clobbered.
 */
export async function closeOrphanGenerations(): Promise<number> {
  const result = await db
    .update(launches)
    .set({
      assetsCache: sql`
        jsonb_set(
          jsonb_set(
            ${launches.assetsCache}::jsonb,
            '{generation,finishedAt}',
            to_jsonb(now()::text)
          ),
          '{generation,interrupted}',
          'true'::jsonb
        )
      `,
      updatedAt: new Date(),
    })
    .where(
      sql`${launches.assetsCache}::jsonb -> 'generation' ? 'startedAt'
          and not (${launches.assetsCache}::jsonb -> 'generation' ? 'finishedAt')`,
    )
    .returning({ slug: launches.slug });

  if (result.length) {
    console.log(
      `[startup] ${result.length} generación(es) quedaron a medias en el proceso anterior: ${result
        .map((row) => row.slug)
        .join(", ")}`,
    );
  }
  return result.length;
}
