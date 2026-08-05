// Telegram Bot API client.
// Docs: https://core.telegram.org/bots/api
// Auth: token in URL path. Each org stores its bot token encrypted in
// organization_integrations (same pattern as ActiveCampaign / Stripe).

import { getDecryptedCredential } from "@/server/integrations";
import type { SingleTokenCredentials } from "@/server/integrations";

export class TelegramError extends Error {
  constructor(public status: number, public body: string) {
    super(`Telegram ${status}: ${body}`);
  }
}

/** Resolve the Telegram bot token for an organization from the DB. */
export async function getTelegramToken(organizationId: string): Promise<string | null> {
  const creds = await getDecryptedCredential<SingleTokenCredentials>(organizationId, "telegram");
  return creds?.token ?? null;
}

/** Check if Telegram is configured for an org (token exists in DB). */
export async function isTelegramConfigured(organizationId: string): Promise<boolean> {
  return Boolean(await getTelegramToken(organizationId));
}

function requireToken(orgBotToken: string | null | undefined): string {
  if (!orgBotToken) throw new TelegramError(0, "No Telegram bot token configured");
  return orgBotToken;
}

// ---- Low-level API wrapper ----

async function tg<T>(
  method: string,
  body: Record<string, unknown>,
  orgBotToken?: string | null,
): Promise<T> {
  const token = requireToken(orgBotToken);
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    throw new TelegramError(res.status, json.description ?? "Unknown error");
  }
  return json.result as T;
}

// ---- Types ----

export type TGChat = {
  id: number;
  type: "group" | "supergroup" | "channel" | "private";
  title?: string;
  username?: string;
};

export type TGChatMember = {
  status: "creator" | "administrator" | "member" | "restricted" | "left" | "kicked";
  user: { id: number; is_bot: boolean; first_name: string };
};

export type TGMessage = {
  message_id: number;
  chat: TGChat;
  text?: string;
};

export type TGInviteLink = {
  invite_link: string;
  creator: { id: number };
  name?: string;
};

// ---- Operations ----

export async function getChat(chatId: string, orgBotToken?: string | null): Promise<TGChat> {
  return tg<TGChat>("getChat", { chat_id: chatId }, orgBotToken);
}

export async function getChatMember(
  chatId: string,
  userId: number,
  orgBotToken?: string | null,
): Promise<TGChatMember> {
  return tg<TGChatMember>("getChatMember", { chat_id: chatId, user_id: userId }, orgBotToken);
}

export async function getChatMemberCount(chatId: string, orgBotToken?: string | null): Promise<number> {
  return tg<number>("getChatMemberCount", { chat_id: chatId }, orgBotToken);
}

export async function sendMessage(
  chatId: string,
  text: string,
  opts: { parseMode?: "MarkdownV2" | "HTML" } = {},
  orgBotToken?: string | null,
): Promise<TGMessage> {
  return tg<TGMessage>(
    "sendMessage",
    {
      chat_id: chatId,
      text,
      parse_mode: opts.parseMode ?? "HTML",
      disable_web_page_preview: true,
    },
    orgBotToken,
  );
}

export async function pinMessage(
  chatId: string,
  messageId: number,
  orgBotToken?: string | null,
): Promise<boolean> {
  return tg<boolean>("pinChatMessage", { chat_id: chatId, message_id: messageId }, orgBotToken);
}

export async function createInviteLink(
  chatId: string,
  opts: { name?: string; expireDate?: number; memberLimit?: number } = {},
  orgBotToken?: string | null,
): Promise<TGInviteLink> {
  return tg<TGInviteLink>(
    "createChatInviteLink",
    { chat_id: chatId, ...opts },
    orgBotToken,
  );
}

export async function getMe(orgBotToken?: string | null) {
  return tg<{ id: number; is_bot: boolean; first_name: string; username: string }>(
    "getMe",
    {},
    orgBotToken,
  );
}

export type TGUpdate = {
  update_id: number;
  message?: TGMessage & { from?: { id: number; first_name: string } };
  my_chat_member?: {
    chat: TGChat;
    new_chat_member: TGChatMember;
  };
};

export async function getUpdates(
  opts: { offset?: number; limit?: number; allowedUpdates?: string[] } = {},
  orgBotToken?: string | null,
): Promise<TGUpdate[]> {
  return tg<TGUpdate[]>(
    "getUpdates",
    {
      offset: opts.offset,
      limit: opts.limit ?? 100,
      allowed_updates: opts.allowedUpdates,
    },
    orgBotToken,
  );
}

/**
 * Discover groups/channels where the bot has been added recently.
 * Scans getUpdates for unique group chats.
 */
export async function discoverGroups(
  orgBotToken?: string | null,
): Promise<{ chatId: string; title: string; type: string }[]> {
  const updates = await getUpdates({}, orgBotToken);
  const seen = new Map<number, { chatId: string; title: string; type: string }>();

  for (const u of updates) {
    const chat = u.message?.chat ?? u.my_chat_member?.chat;
    if (!chat || chat.type === "private") continue;
    if (seen.has(chat.id)) continue;
    seen.set(chat.id, {
      chatId: String(chat.id),
      title: chat.title ?? `Chat ${chat.id}`,
      type: chat.type,
    });
  }

  return Array.from(seen.values());
}

// ---- High-level helpers ----

/**
 * Connect a Telegram group/channel to a launch.
 * Validates the bot is an admin, then creates an invite link.
 */
export async function connectTelegramGroup(
  chatId: string,
  orgBotToken?: string | null,
): Promise<{ chatId: string; title: string; inviteLink: string }> {
  const chat = await getChat(chatId, orgBotToken);
  if (chat.type === "private") {
    throw new TelegramError(400, "Cannot connect a private chat. Use a group or channel.");
  }

  // Verify bot is admin
  const bot = await getMe(orgBotToken);
  const member = await getChatMember(chatId, bot.id, orgBotToken);
  if (member.status !== "administrator" && member.status !== "creator") {
    throw new TelegramError(
      403,
      `The bot is not an admin in this chat (status: ${member.status}). Add @${bot.username} as admin first.`,
    );
  }

  const link = await createInviteLink(chatId, { name: "Botón Rojo" }, orgBotToken);

  return {
    chatId: String(chat.id),
    title: chat.title ?? "Chat",
    inviteLink: link.invite_link,
  };
}

/**
 * Register a webhook URL so Telegram pushes updates instead of polling.
 */
export async function registerWebhook(
  appUrl: string,
  secretToken: string,
  orgBotToken?: string | null,
): Promise<boolean> {
  return tg<boolean>(
    "setWebhook",
    {
      url: `${appUrl}/api/telegram/webhook`,
      secret_token: secretToken,
      allowed_updates: ["message", "my_chat_member"],
    },
    orgBotToken,
  );
}

export async function deleteWebhook(orgBotToken?: string | null): Promise<boolean> {
  return tg<boolean>("deleteWebhook", {}, orgBotToken);
}
