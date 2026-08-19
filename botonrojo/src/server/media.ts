"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { mediaItems, launches } from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import {
  removeObject,
  storage,
  BUCKET,
  ensureBucket,
  publicUrlFor,
} from "@/integrations/storage";
import { createId } from "@/lib/ids";
import {
  generateImage,
  isImageGenConfigured,
  type ImageSlot,
} from "@/integrations/image-gen";

/**
 * Las fotos de un lanzamiento, o todas las de la cuenta si no se dice cuál.
 *
 * Con `launchId` entran también las que no tienen lanzamiento: son las que se
 * subieron cuando la biblioteca era una sola para toda la cuenta, y esconderlas
 * habría vaciado de golpe la biblioteca de quien ya estaba trabajando.
 */
export async function listMediaItems(launchId?: string) {
  const { organizationId } = await requireOrgAdmin();
  return db
    .select()
    .from(mediaItems)
    .where(
      launchId
        ? and(
            eq(mediaItems.organizationId, organizationId),
            or(eq(mediaItems.launchId, launchId), isNull(mediaItems.launchId)),
          )
        : eq(mediaItems.organizationId, organizationId),
    )
    .orderBy(desc(mediaItems.createdAt));
}

/** Same org-scoped lookup, for server code that already knows the org. */
export async function getMediaItemForOrg(id: string, organizationId: string) {
  const [item] = await db
    .select()
    .from(mediaItems)
    .where(and(eq(mediaItems.id, id), eq(mediaItems.organizationId, organizationId)))
    .limit(1);
  return item ?? null;
}

export async function deleteMediaItemAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const id = String(formData.get("id") ?? "");

  const item = await getMediaItemForOrg(id, organizationId);
  if (!item) throw new Error("media_not_found");

  await db.delete(mediaItems).where(eq(mediaItems.id, id));
  await removeObject(item.storageKey);

  revalidatePath("/admin/anuncios");
}

export async function updateMediaLabelAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim() || null;

  const item = await getMediaItemForOrg(id, organizationId);
  if (!item) throw new Error("media_not_found");

  await db.update(mediaItems).set({ label }).where(eq(mediaItems.id, id));
  revalidatePath("/admin/anuncios");
}

/**
 * Una foto nueva descrita con palabras, hecha por Magnific y guardada en la
 * biblioteca del lanzamiento.
 *
 * Hasta ahora la biblioteca solo admitía fotos del cliente, lo que dejaba sin
 * estáticos a cualquier lanzamiento que no tuviera una sesión de fotos hecha —
 * que son casi todos al principio. La imagen se descarga y se guarda en nuestro
 * almacenamiento en vez de apuntar a la URL de Magnific: esas caducan, y una
 * biblioteca con fotos que desaparecen a los días no es una biblioteca.
 */
export async function generateMediaItemAction(
  launchId: string,
  formData: FormData,
) {
  const { organizationId, user } = await requireOrgAdmin();
  if (!organizationId) throw new Error("no_organization");
  if (!isImageGenConfigured()) throw new Error("magnific_not_configured");

  const [launch] = await db
    .select()
    .from(launches)
    .where(
      and(eq(launches.id, launchId), eq(launches.organizationId, organizationId)),
    )
    .limit(1);
  if (!launch) throw new Error("launch_not_found");

  const prompt = String(formData.get("prompt") ?? "").trim();
  if (prompt.length < 8) throw new Error("prompt_too_short");

  const slotPedido = String(formData.get("slot") ?? "square");
  const slot: ImageSlot = (
    ["hero", "band", "card", "portrait", "story", "square"] as const
  ).includes(slotPedido as ImageSlot)
    ? (slotPedido as ImageSlot)
    : "square";

  // Con la paleta y el mood del lanzamiento: una foto en otros colores se nota
  // pegada aunque esté bien hecha, y es el motivo por el que las generadas
  // parecían de otra campaña.
  const remoteUrl = await generateImage(prompt, {
    slot,
    palette: launch.brandPalette,
    moodNotes: launch.brandMoodNotes,
  });

  const res = await fetch(remoteUrl);
  if (!res.ok) throw new Error(`image_download_failed: ${res.status}`);
  const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "image/png";
  const buf = Buffer.from(await res.arrayBuffer());

  await ensureBucket();
  const ext = mimeType.split("/")[1] ?? "png";
  const storageKey = `media/${organizationId}/${new Date().toISOString().slice(0, 10)}/${createId(12)}.${ext}`;
  await storage.putObject(BUCKET, storageKey, buf, buf.length, {
    "Content-Type": mimeType,
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  await db.insert(mediaItems).values({
    organizationId,
    launchId,
    url: publicUrlFor(storageKey),
    storageKey,
    filename: `${prompt.slice(0, 40).replace(/[^a-z0-9áéíóúñ ]/gi, "")}.${ext}`,
    mimeType,
    label: prompt.slice(0, 120),
    prompt,
    source: "magnific",
    uploadedBy: user.id,
  });

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
  revalidatePath("/admin/anuncios");
}
