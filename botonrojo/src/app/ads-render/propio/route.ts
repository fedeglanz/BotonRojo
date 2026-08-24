import { eq } from "drizzle-orm";

import { db } from "@/db";
import { assets } from "@/db/schema";
import { verifyPayload } from "@/lib/crypto";
import { isDesignedAdBody } from "@/server/designed-ads";

export const dynamic = "force-dynamic";

/**
 * Sirve el HTML de un anuncio diseñado en Claude para que el servicio de capturas
 * lo fotografíe.
 *
 * Es una ruta y no una página porque lo que llega de Claude es un documento
 * completo, con su `<html>` y su `<head>`: meterlo dentro del layout de la
 * aplicación lo pintaría con nuestros estilos encima, que es justo lo que no se
 * quiere ver en un anuncio.
 *
 * Sin sesión, igual que `/ads-render`: el capturador es un Chromium sin cuenta. Lo
 * que la protege es la firma — el id del asset viaja en un payload con HMAC, así
 * que no se puede pedir el anuncio de otro cambiando un número en la URL.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const p = url.searchParams.get("p");
  const sig = url.searchParams.get("sig");
  if (!p || !sig) return new Response("no", { status: 404 });

  const payload = verifyPayload<{ assetId: string }>(p, sig);
  if (!payload?.assetId) return new Response("no", { status: 404 });

  const [asset] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, payload.assetId))
    .limit(1);

  if (!asset || !isDesignedAdBody(asset.body)) {
    return new Response("no", { status: 404 });
  }

  return new Response(asset.body.html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Se fotografía justo después de guardarlo: una copia cacheada devolvería
      // el diseño anterior y el PNG saldría del anuncio de antes.
      "Cache-Control": "no-store",
    },
  });
}
