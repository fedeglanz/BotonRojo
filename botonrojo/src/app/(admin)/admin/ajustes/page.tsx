import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { requireOrgAdmin } from "@/lib/org";
import { getMe } from "@/integrations/telegram";
import { TelegramTokenForm } from "@/components/admin/telegram-token-form";

export const dynamic = "force-dynamic";

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

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
          Ajustes
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Configuración de la organización <strong className="text-zinc-200">{org?.name}</strong>
        </p>
      </header>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Telegram Bot</h2>
          <p className="text-sm text-zinc-400">
            Conectá tu bot de Telegram para enviar mensajes automáticos desde los lanzamientos.
          </p>
        </div>
        <TelegramTokenForm
          currentToken={org?.telegramBotToken ?? null}
          currentBotUsername={botUsername}
        />
      </section>
    </div>
  );
}
