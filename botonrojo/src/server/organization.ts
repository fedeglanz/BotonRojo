"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { requireOrgAdmin } from "@/lib/org";
import { getMe } from "@/integrations/telegram";

export async function saveTelegramBotTokenAction(_prev: unknown, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const token = z.string().trim().parse(formData.get("botToken") ?? "");

  // If token provided, validate it by calling getMe
  if (token) {
    try {
      const bot = await getMe(token);
      await db
        .update(organizations)
        .set({ telegramBotToken: token, updatedAt: new Date() })
        .where(eq(organizations.id, organizationId));

      revalidatePath("/admin/ajustes");
      return { ok: true as const, botUsername: bot.username };
    } catch {
      return { ok: false as const, error: "Token inválido. Verificá que sea correcto y que el bot exista." };
    }
  }

  return { ok: false as const, error: "Ingresá un token válido." };
}

export async function removeTelegramBotTokenAction() {
  const { organizationId } = await requireOrgAdmin();

  await db
    .update(organizations)
    .set({ telegramBotToken: null, updatedAt: new Date() })
    .where(eq(organizations.id, organizationId));

  revalidatePath("/admin/ajustes");
}
