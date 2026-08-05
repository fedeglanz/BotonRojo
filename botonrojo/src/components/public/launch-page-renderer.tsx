import { db } from "@/db";
import { assets, organizations, products } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";

import { LaunchLandingPage } from "@/components/public/launch-landing";
import { RegistroPage } from "@/components/public/registro-page";
import { ContenidoPage } from "@/components/public/contenido-page";
import { LegalPage } from "@/components/public/legal-page";
import { AfiliadosPage } from "@/components/public/afiliados-page";
import { pagePath, contentUnlockDate, type PageDef } from "@/lib/launch-pages";
import { canEditLaunch, EDIT_DISABLED, type EditContext } from "@/components/public/edit-mode";
import { CustomHtmlPage } from "@/components/public/custom-html-page";
import { isCustomPageBody } from "@/lib/custom-page";
import type { Launch } from "@/db/schema/launches";
import type {
  RegistroPageBody,
  ContenidoPageBody,
  LegalPageBody,
  AfiliadosPageBody,
} from "@/components/public/page-bodies";

/** Central "which component renders this page kind" dispatch — the only
 * place that needs to know all 5 kinds exist. */
export async function renderLaunchPage(
  launch: Launch,
  pageDef: PageDef,
  allPages: PageDef[],
  searchParams?: { editar?: string },
) {
  // Decided on the server from the session. `?editar=1` only expresses intent: a
  // visitor who guesses the parameter gets the ordinary page, because the value
  // they can influence isn't the one that decides.
  const canEdit = await canEditLaunch(launch, searchParams);
  const edit: EditContext = canEdit
    ? { enabled: true, launchId: launch.id, launchSlug: launch.slug, pageKey: pageDef.pageKey }
    : EDIT_DISABLED;

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "landing"), eq(assets.pageKey, pageDef.pageKey)))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  // A page designed outside the app wins over every generated renderer: that's
  // what publishing one means. Checked before the kind dispatch so it works on the
  // sales page too, which otherwise loads its own body further down.
  if (isCustomPageBody(asset?.body)) {
    const activeProducts = await db
      .select()
      .from(products)
      .where(and(eq(products.launchId, launch.id), eq(products.active, true)));

    return (
      <CustomHtmlPage
        launch={launch}
        body={asset.body}
        pageKey={pageDef.pageKey}
        products={activeProducts}
      />
    );
  }

  if (pageDef.kind === "venta") {
    return <LaunchLandingPage launch={launch} pageKey={pageDef.pageKey} edit={edit} />;
  }

  if (pageDef.kind === "registro") {
    return <RegistroPage launch={launch} body={(asset?.body as RegistroPageBody) ?? null} edit={edit} />;
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
        edit={edit}
      />
    );
  }

  if (pageDef.kind === "legal") {
    return <LegalPage launch={launch} body={(asset?.body as LegalPageBody) ?? null} />;
  }

  if (pageDef.kind === "afiliados") {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, launch.organizationId)).limit(1);
    const signupHref = `/registro-afiliado?org=${org?.slug ?? ""}`;
    return <AfiliadosPage launch={launch} body={(asset?.body as AfiliadosPageBody) ?? null} signupHref={signupHref} edit={edit} />;
  }

  return null;
}
