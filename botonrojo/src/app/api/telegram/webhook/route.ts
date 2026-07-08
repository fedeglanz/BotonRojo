import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { launches } from "@/db/schema";
import { env } from "@/lib/env";
import { sendMessage, type TGUpdate } from "@/integrations/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Verify secret token
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let update: TGUpdate;
  try {
    update = (await req.json()) as TGUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Handle /start command in groups
  if (update.message?.text?.startsWith("/start") && update.message.chat.type !== "private") {
    const chat = update.message.chat;
    const chatId = String(chat.id);

    // Check if this group is already connected to a launch
    const [existing] = await db
      .select({ id: launches.id, name: launches.name })
      .from(launches)
      .where(eq(launches.telegramChatId, chatId))
      .limit(1);

    if (existing) {
      await sendMessage(
        chatId,
        `👋 <b>¡Hola!</b> Este grupo ya está conectado al lanzamiento <b>${existing.name}</b>.`,
      ).catch(() => {});
    } else {
      await sendMessage(
        chatId,
        `👋 <b>¡Hola!</b> Bot de Botón Rojo listo.\n\n` +
        `Chat ID: <code>${chatId}</code>\n\n` +
        `Podés conectar este grupo desde el panel de admin usando "Detectar grupos".`,
      ).catch(() => {});
    }
  }

  // Handle bot added/removed from group
  if (update.my_chat_member) {
    const { chat, new_chat_member } = update.my_chat_member;
    if (!new_chat_member.user.is_bot) {
      return NextResponse.json({ ok: true });
    }

    const chatId = String(chat.id);
    const isAdmin = new_chat_member.status === "administrator" || new_chat_member.status === "creator";
    const wasRemoved = new_chat_member.status === "left" || new_chat_member.status === "kicked";

    if (wasRemoved) {
      // Bot was removed — mark as not added
      await db
        .update(launches)
        .set({ telegramBotAdded: false, updatedAt: new Date() })
        .where(eq(launches.telegramChatId, chatId));
    } else if (isAdmin) {
      // Bot was promoted to admin
      await db
        .update(launches)
        .set({ telegramBotAdded: true, updatedAt: new Date() })
        .where(eq(launches.telegramChatId, chatId));
    }
  }

  return NextResponse.json({ ok: true });
}
