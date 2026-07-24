import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { requireOrgAdmin } from "@/lib/org";
import { getMe } from "@/integrations/telegram";
import { TelegramTokenForm } from "@/components/admin/telegram-token-form";
import { env } from "@/lib/env";
import { listLaunchesForFilter } from "@/server/stats";
import {
  listExternalSalesSources,
  addExternalSalesSourceAction,
  testExternalSalesSourceAction,
  removeExternalSalesSourceAction,
  updateExternalSalesSourceColumnsAction,
} from "@/server/external-sales";
import { ExternalSalesPanel } from "@/components/admin/external-sales-panel";

export const dynamic = "force-dynamic";

const INTEGRATIONS = [
  { name: "ActiveCampaign", configured: Boolean(env.ACTIVECAMPAIGN_API_URL && env.ACTIVECAMPAIGN_API_KEY), envVars: "ACTIVECAMPAIGN_API_URL, ACTIVECAMPAIGN_API_KEY" },
  { name: "Stripe", configured: Boolean(env.STRIPE_SECRET_KEY), envVars: "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET" },
  { name: "Resend (email)", configured: Boolean(env.RESEND_API_KEY), envVars: "RESEND_API_KEY" },
  { name: "Telegram", configured: Boolean(env.TELEGRAM_BOT_TOKEN), envVars: "TELEGRAM_BOT_TOKEN" },
  { name: "Notion", configured: Boolean(env.NOTION_TOKEN), envVars: "NOTION_TOKEN" },
  { name: "YouTube", configured: Boolean(env.YOUTUBE_API_KEY), envVars: "YOUTUBE_API_KEY" },
  { name: "Meta Ads", configured: Boolean(env.META_ACCESS_TOKEN), envVars: "META_ACCESS_TOKEN" },
  { name: "Google Ads", configured: Boolean(env.GOOGLE_ADS_DEVELOPER_TOKEN), envVars: "GOOGLE_ADS_DEVELOPER_TOKEN" },
  { name: "Unsplash", configured: Boolean(env.UNSPLASH_ACCESS_KEY), envVars: "UNSPLASH_ACCESS_KEY" },
  { name: "Replicate (IA imagen)", configured: Boolean(env.REPLICATE_API_TOKEN), envVars: "REPLICATE_API_TOKEN" },
  { name: "Anthropic (Claude)", configured: Boolean(env.ANTHROPIC_API_KEY), envVars: "ANTHROPIC_API_KEY" },
];

export default async function AjustesPage() {
  const { organizationId } = await requireOrgAdmin();

  const [org] = await db
    .select({ name: organizations.name, telegramBotToken: organizations.telegramBotToken })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  // Try to get bot username if token exists
  let botUsername: string | null = null;
  if (org?.telegramBotToken) {
    try {
      const bot = await getMe(org.telegramBotToken);
      botUsername = bot.username;
    } catch {
      // Token might be invalid
    }
  }

  const [launches, sources] = await Promise.all([
    listLaunchesForFilter(),
    listExternalSalesSources(),
  ]);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
          Ajustes
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configuracion de la organizacion <strong className="text-zinc-200">{org?.name}</strong>
        </p>
      </header>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
          Integraciones
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Se configuran por variables de entorno en el servidor (<code>.env</code>) — no se editan aqui para no
          guardar secretos en la base de datos. Reinicia el contenedor <code>app</code> tras cambiarlas.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INTEGRATIONS.map((i) => (
            <div key={i.name} className="glass flex items-start justify-between gap-3 p-4">
              <div>
                <div className="text-sm font-medium text-white">{i.name}</div>
                <div className="mt-1 font-[family-name:var(--font-mono)] text-[10px] text-zinc-500">{i.envVars}</div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                  i.configured
                    ? "border-emerald-500/40 text-emerald-300"
                    : "border-white/10 text-zinc-500"
                }`}
              >
                {i.configured ? "Activo" : "Sin configurar"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
            Telegram Bot
          </h2>
          <p className="text-sm text-zinc-500">
            Conecta tu bot de Telegram para enviar mensajes automaticos desde los lanzamientos.
          </p>
        </div>
        <TelegramTokenForm
          currentToken={org?.telegramBotToken ?? null}
          currentBotUsername={botUsername}
        />
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
          Fuentes de ventas externas
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Conecta la base de datos de otra plataforma de venta (WordPress, ThriveCart, un cart propio del
          cliente…) para verificar ventas de un lanzamiento que no pasan por el Stripe de este sistema.
        </p>
        <div className="mt-4">
          <ExternalSalesPanel
            launches={launches}
            sources={sources}
            addAction={addExternalSalesSourceAction}
            testAction={testExternalSalesSourceAction}
            removeAction={removeExternalSalesSourceAction}
            updateColumnsAction={updateExternalSalesSourceColumnsAction}
          />
        </div>
      </section>
    </div>
  );
}
