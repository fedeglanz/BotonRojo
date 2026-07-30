// ActiveCampaign API v3 client.
// Docs: https://developers.activecampaign.com/reference/overview
// Auth: header `Api-Token: <key>`. Base URL ends in `/api/3` and varies per account.
// Multi-tenant: every organization brings its own AC account — there is no
// global/shared client, everything is built from that org's stored credentials.

import { getDecryptedCredential } from "@/server/integrations";
import type { ActiveCampaignCredentials } from "@/server/integrations";

export class ActiveCampaignError extends Error {
  constructor(public status: number, public body: string) {
    super(`ActiveCampaign ${status}: ${body}`);
  }
}

export async function getActiveCampaignCredentials(
  organizationId: string,
): Promise<ActiveCampaignCredentials | null> {
  return getDecryptedCredential<ActiveCampaignCredentials>(organizationId, "activecampaign");
}

export async function isActiveCampaignConfigured(organizationId: string): Promise<boolean> {
  return Boolean(await getActiveCampaignCredentials(organizationId));
}

export type ACContact = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
};
export type ACTag = { id: string; tag: string };
export type ACList = { id: string; name: string; stringid: string };
export type ACTemplate = { id: string; name: string; subject: string };

export type ActiveCampaignClient = ReturnType<typeof createActiveCampaignClient>;

export function createActiveCampaignClient(creds: ActiveCampaignCredentials) {
  const baseUrl = creds.apiUrl.replace(/\/$/, "") + "/api/3";

  async function ac<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(baseUrl + path, {
      ...init,
      headers: {
        "Api-Token": creds.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new ActiveCampaignError(res.status, body);
    }
    return (await res.json()) as T;
  }

  async function createOrUpdateContact(input: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    fieldValues?: Array<{ field: string; value: string }>;
  }): Promise<ACContact> {
    const res = await ac<{ contact: ACContact }>("/contact/sync", {
      method: "POST",
      body: JSON.stringify({
        contact: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          fieldValues: input.fieldValues,
        },
      }),
    });
    return res.contact;
  }

  async function findTagByName(name: string): Promise<ACTag | null> {
    const res = await ac<{ tags: ACTag[] }>(`/tags?search=${encodeURIComponent(name)}`);
    return res.tags.find((t) => t.tag.toLowerCase() === name.toLowerCase()) ?? null;
  }

  async function createTag(name: string, description = ""): Promise<ACTag> {
    const res = await ac<{ tag: ACTag }>("/tags", {
      method: "POST",
      body: JSON.stringify({ tag: { tag: name, tagType: "contact", description } }),
    });
    return res.tag;
  }

  async function findOrCreateTag(name: string, description = ""): Promise<ACTag> {
    return (await findTagByName(name)) ?? (await createTag(name, description));
  }

  async function applyTag(contactId: string, tagId: string): Promise<void> {
    await ac("/contactTags", {
      method: "POST",
      body: JSON.stringify({ contactTag: { contact: contactId, tag: tagId } }),
    });
  }

  async function findListByName(name: string): Promise<ACList | null> {
    const res = await ac<{ lists: ACList[] }>(`/lists?filters[name]=${encodeURIComponent(name)}`);
    return res.lists.find((l) => l.name === name) ?? null;
  }

  async function createList(input: { name: string; senderUrl: string; senderReminder: string }): Promise<ACList> {
    const res = await ac<{ list: ACList }>("/lists", {
      method: "POST",
      body: JSON.stringify({
        list: {
          name: input.name,
          stringid: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64),
          sender_url: input.senderUrl,
          sender_reminder: input.senderReminder,
        },
      }),
    });
    return res.list;
  }

  async function findOrCreateList(input: { name: string; senderUrl: string; senderReminder: string }): Promise<ACList> {
    return (await findListByName(input.name)) ?? (await createList(input));
  }

  async function subscribeToList(contactId: string, listId: string | number): Promise<void> {
    await ac("/contactLists", {
      method: "POST",
      body: JSON.stringify({
        contactList: { list: String(listId), contact: contactId, status: 1 },
      }),
    });
  }

  async function createEmailTemplate(input: {
    name: string;
    subject: string;
    html: string;
    fromName?: string;
    fromEmail?: string;
  }): Promise<ACTemplate> {
    const res = await ac<{ template: ACTemplate }>("/templates", {
      method: "POST",
      body: JSON.stringify({
        template: {
          name: input.name,
          subject: input.subject,
          fromemail: input.fromEmail ?? creds.fromEmail,
          fromname: input.fromName ?? creds.fromName,
          html: input.html,
        },
      }),
    });
    return res.template;
  }

  async function provisionLaunchInAc(input: { launchSlug: string; launchName: string; publicUrl: string }) {
    const list = await findOrCreateList({
      name: `Lanz: ${input.launchName}`,
      senderUrl: input.publicUrl,
      senderReminder: `Te suscribiste en ${input.publicUrl}`,
    });

    const tagSpecs = [
      { key: "registro", suffix: "-registro", description: "Registro / lead" },
      { key: "comprador", suffix: "-comprador", description: "Compradores" },
      { key: "evento", suffix: "-evento", description: "Asistente a evento" },
      { key: "abandono", suffix: "-carrito-abandono", description: "Carrito abandonado" },
    ];

    const tagIds: Record<string, number> = {};
    for (const t of tagSpecs) {
      const tag = await findOrCreateTag(`${input.launchSlug}${t.suffix}`, t.description);
      tagIds[t.key] = Number(tag.id);
    }

    return { listId: Number(list.id), tagIds };
  }

  async function syncLeadToAc(input: {
    email: string;
    name?: string;
    launchSlug: string;
    launchListId?: number | null;
    launchTagIds?: Record<string, number>;
    intent: "registro" | "comprador" | "evento";
  }) {
    const [firstName, ...rest] = (input.name ?? "").split(" ");
    const contact = await createOrUpdateContact({
      email: input.email,
      firstName,
      lastName: rest.join(" ") || undefined,
    });

    if (input.launchListId) {
      await subscribeToList(contact.id, input.launchListId).catch(() => {});
    }

    const tagId = input.launchTagIds?.[input.intent];
    if (tagId) {
      await applyTag(contact.id, String(tagId)).catch(() => {});
    }

    return contact;
  }

  return {
    createOrUpdateContact,
    findTagByName,
    createTag,
    findOrCreateTag,
    applyTag,
    findListByName,
    createList,
    findOrCreateList,
    subscribeToList,
    createEmailTemplate,
    provisionLaunchInAc,
    syncLeadToAc,
  };
}

/** Convenience: resolve an org's client, or null if ActiveCampaign isn't connected. */
export async function getActiveCampaignClientForOrg(organizationId: string): Promise<ActiveCampaignClient | null> {
  const creds = await getActiveCampaignCredentials(organizationId);
  if (!creds) return null;
  return createActiveCampaignClient(creds);
}
