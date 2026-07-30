import { db } from "@/db";
import { assets, organizations } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

import { LaunchLandingPage } from "@/components/public/launch-landing";
import { RegistroPage } from "@/components/public/registro-page";
import { ContenidoPage } from "@/components/public/contenido-page";
import { LegalPage } from "@/components/public/legal-page";
import { AfiliadosPage } from "@/components/public/afiliados-page";
import { pagePath, contentUnlockDate, type PageDef } from "@/lib/launch-pages";
import type { Launch } from "@/db/schema/launches";
import type {
  RegistroPageBody,
  ContenidoPageBody,
  LegalPageBody,
  AfiliadosPageBody,
} from "@/components/public/page-bodies";

/** Central "which component renders this page kind" dispatch — the only
 * place that needs to know all 5 kinds exist. */
export async function renderLaunchPage(launch: Launch, pageDef: PageDef, allPages: PageDef[]) {
  if (pageDef.kind === "venta") {
    return <LaunchLandingPage launch={launch} pageKey={pageDef.pageKey} />;
  }

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "landing"), eq(assets.pageKey, pageDef.pageKey)))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  if (pageDef.kind === "registro") {
    return <RegistroPage launch={launch} body={(asset?.body as RegistroPageBody) ?? null} />;
  }

  if (pageDef.kind === "contenido") {
    const contentPages = allPages.filter((p) => p.kind === "contenido");
    const idx = contentPages.findIndex((p) => p.pageKey === pageDef.pageKey);
    const nextContentPage = contentPages[idx + 1];
    const nextPage = nextContentPage ?? allPages.find((p) => p.kind === "venta");
    const nextHref = nextPage ? pagePath(launch.slug, nextPage) : `/${launch.slug}`;

    const ownUnlock = contentUnlockDate(launch.contentDripStartsAt, pageDef.pageKey);
    const lockedUntil = ownUnlock && ownUnlock.getTime() > Date.now() ? ownUnlock : null;
    const nextUnlock = nextContentPage
      ? contentUnlockDate(launch.contentDripStartsAt, nextContentPage.pageKey)
      : null;

    return (
      <ContenidoPage
        launch={launch}
        body={(asset?.body as ContenidoPageBody) ?? null}
        nextHref={nextHref}
        index={idx + 1}
        total={contentPages.length}
        nextUnlockDate={nextUnlock && nextUnlock.getTime() > Date.now() ? nextUnlock : null}
        lockedUntil={lockedUntil}
      />
    );
  }

  if (pageDef.kind === "legal") {
    return <LegalPage launch={launch} body={(asset?.body as LegalPageBody) ?? null} />;
  }

  if (pageDef.kind === "afiliados") {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, launch.organizationId)).limit(1);
    const signupHref = `/registro-afiliado?org=${org?.slug ?? ""}`;
    return <AfiliadosPage launch={launch} body={(asset?.body as AfiliadosPageBody) ?? null} signupHref={signupHref} />;
  }

  return null;
}
