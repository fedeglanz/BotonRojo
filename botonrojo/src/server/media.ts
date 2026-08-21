"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { mediaItems, launches } from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { removeObject } from "@/integrations/storage";
import { isImageGenConfigured, type ImageSlot } from "@/integrations/image-gen";
import { generateMediaForLaunch } from "@/server/media-store";

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

  const prompt = String(formData.get("prompt") ?? "").trim();
  if (prompt.length < 8) throw new Error("prompt_too_short");

  const slotPedido = String(formData.get("slot") ?? "square");
  const slot: ImageSlot = (
    ["hero", "band", "card", "portrait", "story", "square"] as const
  ).includes(slotPedido as ImageSlot)
    ? (slotPedido as ImageSlot)
    : "square";

  await generateMediaForLaunch({
    organizationId,
    launchId,
    prompt,
    slot,
    uploadedBy: user.id,
  });

  const [launch] = await db
    .select({ slug: launches.slug })
    .from(launches)
    .where(eq(launches.id, launchId))
    .limit(1);
  if (launch) revalidatePath(`/admin/lanzamientos/${launch.slug}`);
  revalidatePath("/admin/anuncios");
}
