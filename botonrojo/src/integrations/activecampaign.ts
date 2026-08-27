// ActiveCampaign API v3 client.
// Docs: https://developers.activecampaign.com/reference/overview
// Auth: header `Api-Token: <key>`. Base URL ends in `/api/3` and varies per account.
// Multi-tenant: every organization brings its own AC account — there is no
// global/shared client, everything is built from that org's stored credentials.

import { getDecryptedCredential } from "@/server/integrations";
import { acTagsFor } from "@/lib/ac-tags";
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
export type ACCampaign = {
  id: string;
  name: string;
  type: string;
  status: number;
  sdate?: string;
  // Stats fields (returned by GET /campaigns/:id with totals)
  sends?: number;
  uniqueopens?: number;
  opens?: number;
  uniquelinkclicks?: number;
  linkclicks?: number;
  subscriberclicks?: number;
  forwards?: number;
  uniqueforwards?: number;
  hardbounces?: number;
  softbounces?: number;
  unsubscribes?: number;
  unsubreasons?: number;
  updates?: number;
  socialshares?: number;
  replies?: number;
  uniquereplies?: number;
  // Computed percentages
  openRate?: number;
  clickRate?: number;
  bounceRate?: number;
  unsubRate?: number;
};
export type ACAutomation = {
  id: string;
  name: string;
  status: string; // "1" = active, "0" = inactive
  entered: string; // total contacts entered
  cdate: string;
  mdate: string;
};

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
      console.error(`[AC] ${init.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 500)}`);
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

  /**
   * Todas las listas y todas las etiquetas de la cuenta, para poder elegir.
   *
   * Antes solo se podía crear: cada lanzamiento estrenaba lista y cuatro etiquetas,
   * y quien ya tenía su ActiveCampaign montado —con su lista principal y sus
   * etiquetas de siempre— acababa con estructura duplicada y los contactos
   * repartidos entre dos sitios.
   *
   * Se pagina a mano porque la API devuelve 20 por defecto y una cuenta con años de
   * uso tiene cientos de etiquetas: sin paginar, la que buscas no sale y parece que
   * no existe.
   */
  async function listAllLists(): Promise<ACList[]> {
    const out: ACList[] = [];
    for (let offset = 0; offset < 1000; offset += 100) {
      const res = await ac<{ lists: ACList[] }>(
        `/lists?limit=100&offset=${offset}`,
      );
      out.push(...res.lists);
      if (res.lists.length < 100) break;
    }
    return out;
  }

  async function listAllTags(): Promise<ACTag[]> {
    const out: ACTag[] = [];
    for (let offset = 0; offset < 2000; offset += 100) {
      const res = await ac<{ tags: ACTag[] }>(`/tags?limit=100&offset=${offset}`);
      out.push(...res.tags);
      if (res.tags.length < 100) break;
    }
    return out;
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

  /**
   * Da de baja un email de una lista.
   *
   * En ActiveCampaign la baja es el mismo endpoint que la suscripción con
   * `status: 2`; no hay un "borrar de la lista", y borrar el contacto sería peor:
   * perdería el histórico y, si vuelve a registrarse, no habría forma de saber que
   * un día pidió no recibir nada.
   *
   * Silencioso si el contacto no existe: quien pulsa un enlace de baja tiene que
   * quedarse de baja, y si nunca estuvo en la lista el resultado ya es el que quería.
   */
  async function unsubscribeFromList(email: string, listId: string | number): Promise<boolean> {
    const found = await ac<{ contacts: Array<{ id: string }> }>(
      `/contacts?email=${encodeURIComponent(email)}`,
    ).catch(() => null);
    const contactId = found?.contacts?.[0]?.id;
    if (!contactId) return false;

    await ac("/contactLists", {
      method: "POST",
      body: JSON.stringify({
        contactList: { list: String(listId), contact: contactId, status: 2 },
      }),
    });
    return true;
  }

  async function createEmailTemplate(input: {
    name: string;
    subject: string;
    html: string;
    fromName?: string;
    fromEmail?: string;
  }): Promise<ACTemplate> {
    // Templates are content-only — the sender is set when creating the
    // *campaign*, not the template.  Including fromemail here causes AC to
    // return 500 if the address isn't verified in the account, and there's no
    // benefit: the campaign step already sets fromemail/fromname.
    const payload: Record<string, string> = {
      name: input.name,
      subject: input.subject,
      content: input.html,  // AC API field is "content", not "html"
    };
    // Only add from fields when the caller explicitly passes them (none do today).
    if (input.fromEmail) payload.fromemail = input.fromEmail;
    if (input.fromName) payload.fromname = input.fromName;

    console.log(`[AC] Creating template "${input.name.slice(0, 50)}" (HTML: ${Math.round(input.html.length / 1024)}KB)`);

    const res = await ac<{ template: ACTemplate }>("/templates", {
      method: "POST",
      body: JSON.stringify({ template: payload }),
    });
    return res.template;
  }

  // ---- Campaigns (one-time email sends) ----

  /**
   * Create a campaign (email send) tied to a list.
   * type "single" = one-time broadcast.
   * status: 0 = draft, 1 = scheduled/sending, 2 = sent.
   */
  async function createCampaign(input: {
    name: string;
    listId: string | number;
    templateId: string | number;
    subject: string;
    preheaderText?: string;
    scheduledDate?: string; // ISO 8601, e.g. "2026-08-15T10:00:00-03:00"
  }): Promise<ACCampaign> {
    const res = await ac<{ campaign: ACCampaign }>("/campaigns", {
      method: "POST",
      body: JSON.stringify({
        campaign: {
          type: "single",
          name: input.name,
          sdate: input.scheduledDate ?? null,
          status: input.scheduledDate ? 1 : 0, // 1 = scheduled, 0 = draft
          public: 0,
          tracklinks: "all",
          trackopens: 1,
          trackreads: 0,
          segmentid: 0,
          list: String(input.listId),
        },
      }),
    });

    // Link the message (template) to the campaign
    await ac("/campaignMessages", {
      method: "POST",
      body: JSON.stringify({
        campaignMessage: {
          campaign: res.campaign.id,
          message: String(input.templateId),
          subject: input.subject,
          preheader_text: input.preheaderText ?? "",
          fromemail: creds.fromEmail,
          fromname: creds.fromName,
          reply2: creds.fromEmail,
        },
      }),
    });

    return res.campaign;
  }

  /** List campaigns for a specific name prefix (to check for duplicates). */
  async function findCampaignsByPrefix(prefix: string): Promise<ACCampaign[]> {
    const res = await ac<{ campaigns: ACCampaign[] }>(`/campaigns?search=${encodeURIComponent(prefix)}&orders[sdate]=ASC`);
    return res.campaigns ?? [];
  }

  /** Delete a campaign (draft only, AC won't let you delete sent ones). */
  async function deleteCampaign(campaignId: string): Promise<void> {
    await ac(`/campaigns/${campaignId}`, { method: "DELETE" });
  }

  // ---- Contact automations ----

  /** Add a contact to an existing automation by automation ID. */
  async function addContactToAutomation(contactId: string, automationId: string): Promise<void> {
    await ac("/contactAutomations", {
      method: "POST",
      body: JSON.stringify({
        contactAutomation: { contact: contactId, automation: automationId },
      }),
    });
  }

  // ---- Automations ----

  /** List all automations in the account (paginated, fetches up to 100). */
  async function listAutomations(): Promise<ACAutomation[]> {
    const res = await ac<{ automations: ACAutomation[] }>("/automations?limit=100&orders[name]=ASC");
    return res.automations ?? [];
  }

  // ---- Campaign stats ----

  /** Get a single campaign with full stats. */
  async function getCampaignWithStats(campaignId: string): Promise<ACCampaign> {
    const res = await ac<{ campaign: ACCampaign }>(`/campaigns/${campaignId}`);
    const c = res.campaign;
    const sends = c.sends ?? 0;
    c.openRate = sends > 0 ? ((c.uniqueopens ?? 0) / sends) * 100 : 0;
    c.clickRate = sends > 0 ? ((c.uniquelinkclicks ?? 0) / sends) * 100 : 0;
    c.bounceRate = sends > 0 ? (((c.hardbounces ?? 0) + (c.softbounces ?? 0)) / sends) * 100 : 0;
    c.unsubRate = sends > 0 ? ((c.unsubscribes ?? 0) / sends) * 100 : 0;
    return c;
  }

  /** Get stats for multiple campaigns by ID. */
  async function getCampaignsWithStats(campaignIds: string[]): Promise<ACCampaign[]> {
    const results: ACCampaign[] = [];
    for (const id of campaignIds) {
      try {
        results.push(await getCampaignWithStats(id));
      } catch {
        // Campaign may have been deleted in AC
      }
    }
    return results;
  }

  // ---- High-level helpers ----

  async function provisionLaunchInAc(input: {
    launchSlug: string;
    launchName: string;
    publicUrl: string;
    /** Decide el juego de etiquetas: una newsletter no compra ni abandona carritos. */
    launchType?: string;
  }) {
    const list = await findOrCreateList({
      name: `Lanz: ${input.launchName}`,
      senderUrl: input.publicUrl,
      senderReminder: `Te suscribiste en ${input.publicUrl}`,
    });

    const tagSpecs = acTagsFor(input.launchType ?? "");

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
    automationIds?: string[];
    /**
     * Con qué clave de `activeCampaignTagIds` etiquetar. Es texto y no una lista
     * cerrada porque el juego de etiquetas depende del tipo de lanzamiento: una
     * newsletter etiqueta "suscrito" y "desuscrito", una venta "registro",
     * "comprador", "evento" y "abandono". Quien llama lo resuelve con `altaTagKey`.
     */
    intent: string;
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

    // Add contact to linked automations
    if (input.automationIds?.length) {
      for (const autoId of input.automationIds) {
        await addContactToAutomation(contact.id, autoId).catch(() => {});
      }
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
    unsubscribeFromList,
    createEmailTemplate,
    createCampaign,
    findCampaignsByPrefix,
    deleteCampaign,
    addContactToAutomation,
    listAutomations,
    getCampaignWithStats,
    getCampaignsWithStats,
    provisionLaunchInAc,
    syncLeadToAc,
    listAllLists,
    listAllTags,
  };
}

/** Convenience: resolve an org's client, or null if ActiveCampaign isn't connected. */
export async function getActiveCampaignClientForOrg(organizationId: string): Promise<ActiveCampaignClient | null> {
  const creds = await getActiveCampaignCredentials(organizationId);
  if (!creds) return null;
  return createActiveCampaignClient(creds);
}
