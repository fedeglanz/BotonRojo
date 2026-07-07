import { db } from "@/db";
import { launches } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { LaunchSelector } from "@/components/admin/launch-selector";
import type { LaunchType } from "@/lib/launch-types";
import { requireOrgAdmin } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const { organizationId } = await requireOrgAdmin();
  const rows = await db.select().from(launches).where(eq(launches.organizationId, organizationId)).orderBy(desc(launches.createdAt)).limit(50);

  const summaries = rows.map((l) => ({
    id: l.id,
    slug: l.slug,
    name: l.name,
    type: l.type as LaunchType,
    status: l.status,
  }));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
          Panel de lanzamientos
        </h1>
        <p className="mt-2 text-zinc-400">
          Elige el tipo de lanzamiento y dispárate. El sistema construye avatar, copy, landing,
          emails, anuncios y carritos por ti.
        </p>
      </div>

      <LaunchSelector launches={summaries} />
    </div>
  );
}
