import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { launches, trackingEvents } from "@/db/schema";
import { getActiveCampaignClientForOrg } from "@/integrations/activecampaign";
import { getClientIp } from "@/lib/tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Baja de la lista de un lanzamiento.
 *
 * Sin token ni confirmación por correo, a propósito: quien pulsa "darme de baja"
 * tiene que quedarse de baja, y cada paso que se le pone en medio es una persona
 * más que acaba marcando el correo como spam — que cuesta mucho más caro que una
 * baja. El único dato que hace falta es el email, y saberlo no da acceso a nada:
 * lo único que se puede hacer con esto es dejar de recibir correos.
 *
 * Se responde OK aunque el email no estuviera en la lista. Decir "ese correo no
 * está" sería confirmar quién está suscrito a quién a cualquiera que pruebe
 * direcciones, y para quien pulsa el resultado es el mismo: no va a recibir nada.
 */
const schema = z.object({
  launchSlug: z.string().min(1),
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const [launch] = await db
    .select()
    .from(launches)
    .where(eq(launches.slug, parsed.data.launchSlug))
    .limit(1);

  if (!launch) {
    return NextResponse.json({ error: "launch_not_found" }, { status: 404 });
  }

  // Queda registrado pase lo que pase con ActiveCampaign: es la prueba de que
  // alguien pidió la baja y cuándo, y eso no puede depender de que un servicio
  // externo responda.
  await db.insert(trackingEvents).values({
    organizationId: launch.organizationId,
    launchId: launch.id,
    type: "click",
    email,
    ip: getClientIp(req.headers),
    userAgent: req.headers.get("user-agent") ?? null,
    payload: { from: "baja", action: "unsubscribe" },
  });

  const listId = launch.activeCampaignListId;
  if (listId) {
    const ac = await getActiveCampaignClientForOrg(launch.organizationId).catch(
      () => null,
    );
    if (ac) {
      await ac
        .unsubscribeFromList(email, listId)
        .catch((err) => console.error("baja en ActiveCampaign falló", err));
    }
  }

  return NextResponse.json({ ok: true });
}
