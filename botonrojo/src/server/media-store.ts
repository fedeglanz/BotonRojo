import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { mediaItems, launches } from "@/db/schema";
import {
  storage,
  BUCKET,
  ensureBucket,
  publicUrlFor,
} from "@/integrations/storage";
import { createId } from "@/lib/ids";
import { generateImage, type ImageSlot } from "@/integrations/image-gen";
import type { MediaItem } from "@/db/schema/media";

/**
 * Guardar fotos en la biblioteca de un lanzamiento, sin pasar por el panel.
 *
 * Vive aparte de `server/media.ts` porque ese fichero es de acciones de servidor
 * —todo lo que exporta queda expuesto al navegador— y esto lo necesita también el
 * conector, que llega con su propio token y sin sesión. Misma escritura, dos
 * puertas de entrada.
 */

const MAX_BYTES = 12 * 1024 * 1024;

async function guardar(input: {
  organizationId: string;
  launchId: string;
  buffer: Buffer;
  mimeType: string;
  filename: string;
  label: string | null;
  prompt: string | null;
  source: "subida" | "magnific" | "conector";
  uploadedBy: string | null;
}): Promise<MediaItem> {
  await ensureBucket();
  const ext = input.mimeType.split("/")[1] ?? "png";
  const storageKey = `media/${input.organizationId}/${new Date().toISOString().slice(0, 10)}/${createId(12)}.${ext}`;

  await storage.putObject(
    BUCKET,
    storageKey,
    input.buffer,
    input.buffer.byteLength,
    {
      "Content-Type": input.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  );

  const [row] = await db
    .insert(mediaItems)
    .values({
      organizationId: input.organizationId,
      launchId: input.launchId,
      url: publicUrlFor(storageKey),
      storageKey,
      filename: input.filename,
      mimeType: input.mimeType,
      label: input.label,
      prompt: input.prompt,
      source: input.source,
      uploadedBy: input.uploadedBy,
    })
    .returning();

  return row!;
}

const TIPOS_DE_IMAGEN = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/svg+xml",
]);

/**
 * Trae una imagen de una URL pública y la deja en la biblioteca.
 *
 * Se guarda copia en vez de apuntar a la url de origen a propósito: lo que se
 * enlaza desde una página publicada tiene que seguir ahí dentro de un año, y una
 * url ajena —la de una IA, la de un Drive, la de un chat— no lo garantiza.
 */
export async function storeMediaFromUrl(input: {
  organizationId: string;
  launchId: string;
  url: string;
  label?: string | null;
  uploadedBy?: string | null;
}): Promise<MediaItem> {
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    throw new Error("url_invalida");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("url_no_http");
  }

  const res = await fetch(parsed, {
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`descarga_fallida_${res.status}`);

  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!TIPOS_DE_IMAGEN.has(mimeType)) {
    throw new Error(`tipo_no_admitido:${mimeType || "desconocido"}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) throw new Error("demasiado_grande");
  // Una imagen de menos de un kilobyte no es una imagen: es una descarga cortada,
  // una página de error guardada como si fuera una foto, o un base64 a medias.
  if (buffer.byteLength < 1024) throw new Error("archivo_sospechosamente_pequeno");

  const nombre = decodeURIComponent(parsed.pathname.split("/").pop() ?? "imagen");

  return guardar({
    organizationId: input.organizationId,
    launchId: input.launchId,
    buffer,
    mimeType,
    filename: nombre.slice(0, 120) || "imagen",
    label: input.label?.trim() || null,
    prompt: null,
    source: "conector",
    uploadedBy: input.uploadedBy ?? null,
  });
}

/** Una foto nueva hecha por Magnific, con la identidad del lanzamiento. */
export async function generateMediaForLaunch(input: {
  organizationId: string;
  launchId: string;
  prompt: string;
  slot: ImageSlot;
  uploadedBy?: string | null;
}): Promise<MediaItem> {
  const [launch] = await db
    .select()
    .from(launches)
    .where(
      and(
        eq(launches.id, input.launchId),
        eq(launches.organizationId, input.organizationId),
      ),
    )
    .limit(1);
  if (!launch) throw new Error("launch_not_found");

  const remoteUrl = await generateImage(input.prompt, {
    slot: input.slot,
    palette: launch.brandPalette,
    moodNotes: launch.brandMoodNotes,
  });

  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`image_download_failed_${res.status}`);
  const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "image/png";
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext = mimeType.split("/")[1] ?? "png";

  return guardar({
    organizationId: input.organizationId,
    launchId: input.launchId,
    buffer,
    mimeType,
    filename: `${input.prompt.slice(0, 40).replace(/[^a-z0-9áéíóúñ ]/gi, "")}.${ext}`,
    label: input.prompt.slice(0, 120),
    prompt: input.prompt,
    source: "magnific",
    uploadedBy: input.uploadedBy ?? null,
  });
}

/** Las fotos de un lanzamiento, más las de la cuenta que nunca se asignaron. */
export async function listMediaForLaunch(input: {
  organizationId: string;
  launchId: string;
}): Promise<MediaItem[]> {
  const rows = await db
    .select()
    .from(mediaItems)
    .where(eq(mediaItems.organizationId, input.organizationId));
  return rows
    .filter((r) => r.launchId === input.launchId || r.launchId === null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
