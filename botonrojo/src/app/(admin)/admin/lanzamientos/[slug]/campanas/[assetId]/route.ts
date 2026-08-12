import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { assets, launches } from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { isCustomEmailBody } from "@/lib/custom-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Previsualiza una campaña diseñada: devuelve su HTML tal cual.
 *
 * Un route handler y no una página porque un email es un documento completo con su
 * propio `<html>` y sus tablas: meterlo en el cascarón de la app lo pintaría con
 * nuestros estilos encima y no se vería lo que va a recibir la gente. Aquí sale byte
 * a byte lo que se subirá a ActiveCampaign.
 *
 * Va bajo /admin, así que pasa por el guardián de sesión: el HTML de una campaña sin
 * enviar no tiene por qué ser público.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; assetId: string }> },
) {
  const { organizationId } = await requireOrgAdmin();
  if (!organizationId) return new Response("Sin organización", { status: 403 });

  const { slug, assetId } = await ctx.params;

  const [row] = await db
    .select({ body: assets.body })
    .from(assets)
    .innerJoin(launches, eq(launches.id, assets.launchId))
    .where(
      and(
        eq(assets.id, assetId),
        eq(assets.organizationId, organizationId),
        eq(launches.slug, slug),
      ),
    )
    .limit(1);

  if (!row || !isCustomEmailBody(row.body)) {
    return new Response("No encontrada", { status: 404 });
  }

  return new Response(row.body.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Sin caché: se previsualiza justo después de republicar.
      "Cache-Control": "no-store",
    },
  });
}
