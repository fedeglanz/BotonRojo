import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { assets } from "@/db/schema";
import { env } from "@/lib/env";
import { signPayload } from "@/lib/crypto";
import { createId } from "@/lib/ids";
import {
  storage,
  BUCKET,
  ensureBucket,
  publicUrlFor,
  removeObject,
} from "@/integrations/storage";
import { AD_FORMATS, type AdFormatKey } from "@/lib/ad-templates";
import type { CustomPageAssets } from "@/lib/custom-page";

/**
 * Un anuncio estático diseñado fuera, en Claude Design.
 *
 * El generador de la plataforma compone la foto y el copy con una de sus cuatro
 * plantillas, que es rápido y suficiente para tirar quince formatos de una tacada.
 * Esto es lo otro: un diseño hecho a mano para una campaña concreta.
 *
 * Lo que llega es un documento HTML, y lo que hace falta subir a Meta o a Google es
 * un PNG del tamaño exacto. En medio está el mismo camino que ya usa el generador:
 * una URL que el servicio de capturas puede abrir, y una foto a la medida del
 * formato. La diferencia es de dónde sale esa URL — allí de un payload firmado con
 * el copy, aquí del propio HTML guardado.
 */

export type DesignedAdBody = {
  formatKey: AdFormatKey;
  width: number;
  height: number;
  /** El documento tal como lo diseñó Claude, para poder rehacer el PNG. */
  html: string;
  files?: CustomPageAssets;
  name: string;
  source: "claude-design";
  designUrl?: string;
  publishedAt: string;
};

export function isDesignedAdBody(body: unknown): body is DesignedAdBody {
  return (
    Boolean(body) &&
    typeof body === "object" &&
    (body as { source?: unknown }).source === "claude-design" &&
    typeof (body as { html?: unknown }).html === "string"
  );
}

/** La URL firmada que el servicio de capturas abre para fotografiar el diseño. */
export function designedAdRenderUrl(assetId: string): string {
  const { p, sig } = signPayload({ assetId });
  return `${env.SCREENSHOT_APP_URL}/ads-render/propio?${new URLSearchParams({ p, sig }).toString()}`;
}

async function capturePng(
  url: string,
  width: number,
  height: number,
): Promise<Buffer> {
  const res = await fetch(`${env.SCREENSHOT_SERVICE_URL}/screenshot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.SCREENSHOT_SERVICE_TOKEN
        ? { "x-screenshot-token": env.SCREENSHOT_SERVICE_TOKEN }
        : {}),
    },
    body: JSON.stringify({ url, width, height, fullPage: false, type: "png" }),
  });
  if (!res.ok) {
    throw new Error(
      `El servicio de capturas ha fallado (${res.status}): ${await res.text()}`,
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function publishDesignedAd(input: {
  organizationId: string;
  launchId: string;
  authorId: string | null;
  name: string;
  formatKey: AdFormatKey;
  html: string;
  files: CustomPageAssets;
  designUrl?: string;
}): Promise<{ assetId: string; imageUrl: string; width: number; height: number }> {
  const format = AD_FORMATS[input.formatKey];

  const body: DesignedAdBody = {
    formatKey: input.formatKey,
    width: format.width,
    height: format.height,
    html: input.html,
    files: input.files,
    name: input.name,
    source: "claude-design",
    ...(input.designUrl ? { designUrl: input.designUrl } : {}),
    publishedAt: new Date().toISOString(),
  };

  // Publicar con el mismo nombre y formato sustituye, como en las campañas: al
  // corregir un anuncio se quiere corregirlo, no acabar con ocho versiones en la
  // galería sin saber cuál es la buena.
  const existentes = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.launchId, input.launchId),
        eq(assets.kind, "ad_image"),
        eq(assets.pageKey, `claude-${input.formatKey}-${input.name}`.slice(0, 120)),
      ),
    )
    .orderBy(desc(assets.createdAt))
    .limit(1);

  const title = `${input.name} · ${format.label}`.slice(0, 200);
  const pageKey = `claude-${input.formatKey}-${input.name}`.slice(0, 120);

  let assetId: string;
  if (existentes[0]) {
    assetId = existentes[0].id;
    await db
      .update(assets)
      .set({
        title,
        body: body as unknown as Record<string, unknown>,
        updatedAt: new Date(),
      })
      .where(eq(assets.id, assetId));
  } else {
    // La fila va antes que la foto porque la URL que se fotografía lleva su id: sin
    // fila no hay nada que enseñarle al navegador. Si la captura falla, se borra.
    const [created] = await db
      .insert(assets)
      .values({
        organizationId: input.organizationId,
        launchId: input.launchId,
        kind: "ad_image",
        pageKey,
        title,
        body: body as unknown as Record<string, unknown>,
        authorId: input.authorId,
        generatedByAi: "claude-design",
      })
      .returning({ id: assets.id });
    assetId = created!.id;
  }

  await ensureBucket();

  let png: Buffer;
  try {
    png = await capturePng(
      designedAdRenderUrl(assetId),
      format.width,
      format.height,
    );
  } catch (err) {
    if (!existentes[0]) {
      await db.delete(assets).where(eq(assets.id, assetId));
    }
    throw err;
  }

  const key = `ads/${input.launchId}/${createId(12)}.png`;
  await storage.putObject(BUCKET, key, png, png.length, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  const imageUrl = publicUrlFor(key);
  try {
    await db
      .update(assets)
      .set({ fileUrl: imageUrl, updatedAt: new Date() })
      .where(eq(assets.id, assetId));
  } catch (err) {
    await removeObject(key);
    throw err;
  }

  return { assetId, imageUrl, width: format.width, height: format.height };
}
