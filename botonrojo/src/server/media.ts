"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { mediaItems } from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { removeObject } from "@/integrations/storage";

export async function listMediaItems() {
  const { organizationId } = await requireOrgAdmin();
  return db
    .select()
    .from(mediaItems)
    .where(eq(mediaItems.organizationId, organizationId))
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
