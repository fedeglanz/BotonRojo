import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { requireOrgAdmin } from "@/lib/auth-helpers";
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
import { listIntegrations, saveIntegrationCredentialAction, disconnectIntegrationAction } from "@/server/integrations";
import { ExternalSalesPanel } from "@/components/admin/external-sales-panel";
import { IntegrationConnectPanel } from "@/components/admin/integration-connect-panel";

export const dynamic = "force-dynamic";

// Per-org integrations (Stripe, AC, Telegram, etc.) are managed via
// IntegrationConnectPanel below — they're encrypted in the DB, not env vars.
// Only platform-level services that the operator pays for live here.

const PLATFORM_INTEGRATIONS = [
  { name: "Anthropic (Claude)", configured: Boolean(env.ANTHROPIC_API_KEY) },
  { name: "Magnific (IA imagen)", configured: Boolean(env.MAGNIFIC_API_KEY) },
  { name: "Unsplash", configured: Boolean(env.UNSPLASH_ACCESS_KEY) },
  { name: "Resend (email)", configured: Boolean(env.RESEND_API_KEY) },
];

export default async function AjustesPage() {
  const { organizationId } = await requireOrgAdmin();
  if (!organizationId) throw new Error("no_organization");

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

  const [launches, sources, connected] = await Promise.all([
    listLaunchesForFilter(),
    listExternalSalesSources(),
    listIntegrations(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">Ajustes</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configuracion de la organizacion <strong className="text-zinc-200">{org?.name}</strong> — integraciones y fuentes de ventas.
        </p>
      </div>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
          Tus integraciones
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Cada dato se guarda cifrado, aislado de cualquier otro cliente. Puedes reconectar o
          desconectar cuando quieras.
        </p>
        <div className="mt-4">
          <IntegrationConnectPanel
            connected={connected}
            saveAction={saveIntegrationCredentialAction}
            disconnectAction={disconnectIntegrationAction}
          />
        </div>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
          Integraciones de la plataforma
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Generación con IA e imágenes — las paga la plataforma, no se configuran por cliente.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_INTEGRATIONS.map((i) => (
            <div key={i.name} className="glass flex items-center justify-between gap-3 p-4">
              <div className="text-sm font-medium text-white">{i.name}</div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                  i.configured ? "border-emerald-500/40 text-emerald-300" : "border-white/10 text-zinc-500"
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
          cliente…) para verificar ventas de un lanzamiento que no pasan por tu Stripe conectado arriba.
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
