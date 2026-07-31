import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { launches } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { LinkGenerator } from "@/components/affiliate/link-generator";
import { CopyLink } from "@/components/affiliate/copy-link";
import { createAffiliateLinkAction, listAffiliateLinks } from "@/server/affiliates";
import { env } from "@/lib/env";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MisEnlacesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.organizationId) redirect("/login");

  const available = await db
    .select({ slug: launches.slug, name: launches.name })
    .from(launches)
    .where(eq(launches.organizationId, session.user.organizationId))
    .orderBy(desc(launches.createdAt));

  const links = await listAffiliateLinks(session.user.id);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">Mis enlaces</h1>
        <p className="mt-1 text-zinc-400">
          Genera enlaces con tu código integrado para cada lanzamiento. Cada visita y conversión
          se atribuye automáticamente.
        </p>
      </header>

      <LinkGenerator launches={available} action={createAffiliateLinkAction} />

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
          Tus enlaces
        </h2>
        <div className="mt-4 space-y-3">
          {links.length === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-sm text-zinc-500">
              Aún no has creado ningún enlace. Usa el formulario de arriba.
            </div>
          )}

          {links.map((l) => {
            const url = `${env.APP_URL}${l.destinationUrl}`;
            return (
              <div key={l.id} className="glass space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white">{l.launchName ?? l.launchSlug}</div>
                    <div className="text-xs text-zinc-500">{formatDate(l.createdAt)}</div>
                  </div>
                  <CopyLink url={url} />
                </div>
                {(l.utmSource || l.utmMedium || l.utmCampaign || l.utmContent) && (
                  <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                    {l.utmSource && <Tag label="source" value={l.utmSource} />}
                    {l.utmMedium && <Tag label="medium" value={l.utmMedium} />}
                    {l.utmCampaign && <Tag label="campaign" value={l.utmCampaign} />}
                    {l.utmContent && <Tag label="content" value={l.utmContent} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Tag({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-[family-name:var(--font-mono)]">
      {label}=<span className="text-[var(--color-red-bright)]">{value}</span>
    </span>
  );
}
