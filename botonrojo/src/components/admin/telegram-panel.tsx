"use client";

import { useState, useTransition } from "react";
import { SubmitButton } from "./submit-button";

type DiscoveredGroup = { chatId: string; title: string; type: string };

type Props = {
  launchId: string;
  launchSlug: string;
  configured: boolean;
  chatId: string | null;
  inviteLink: string | null;
  botAdded: boolean;
  connectAction: (launchId: string, formData: FormData) => Promise<void>;
  disconnectAction: (launchId: string) => Promise<void>;
  testAction: (launchId: string) => Promise<void>;
  discoverAction: () => Promise<DiscoveredGroup[]>;
};

export function TelegramPanel({
  launchId,
  launchSlug,
  configured,
  chatId,
  inviteLink,
  botAdded,
  connectAction,
  disconnectAction,
  testAction,
  discoverAction,
}: Props) {
  const [groups, setGroups] = useState<DiscoveredGroup[]>([]);
  const [discovered, setDiscovered] = useState(false);
  const [discovering, startDiscover] = useTransition();

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
        Telegram no está configurado. El admin de la organización debe pegar su{" "}
        <code>Bot Token</code> (de @BotFather) en Ajustes, o se debe configurar{" "}
        <code>TELEGRAM_BOT_TOKEN</code> en las variables de entorno.
      </div>
    );
  }

  const connected = Boolean(chatId && botAdded);

  return (
    <div className="space-y-4">
      {connected ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-white/5 bg-black/30 p-4">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Chat ID</div>
              <div className="mt-1 font-[family-name:var(--font-mono)] text-sm text-white">
                {chatId}
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-black/30 p-4">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Link de invitación</div>
              <div className="mt-1 text-sm">
                {inviteLink ? (
                  <a
                    href={inviteLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[--color-red-bright] hover:underline break-all"
                  >
                    {inviteLink}
                  </a>
                ) : (
                  <span className="text-zinc-500">—</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <form action={testAction.bind(null, launchId)}>
              <SubmitButton variant="outline" pendingLabel="Enviando…">
                Enviar mensaje de prueba
              </SubmitButton>
            </form>
            <form action={disconnectAction.bind(null, launchId)}>
              <SubmitButton variant="outline" pendingLabel="Desconectando…">
                Desconectar grupo
              </SubmitButton>
            </form>
          </div>

          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
            El bot está conectado al grupo. Los mensajes automáticos (cuando se generen
            en futuros pasos) se enviarán a este chat cuando ocurran eventos como registros
            o ventas.
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-300 space-y-2">
            <p className="font-medium text-white">Para conectar un grupo de Telegram:</p>
            <ol className="list-decimal list-inside space-y-1 text-zinc-400">
              <li>Creá un grupo o canal en Telegram</li>
              <li>Agregá tu bot como <strong className="text-zinc-200">administrador</strong> del grupo</li>
              <li>Enviá <code className="text-[--color-red-bright]">/start</code> en el grupo</li>
              <li>Hacé click en <strong className="text-zinc-200">"Detectar grupos"</strong> abajo</li>
            </ol>
          </div>

          {/* Discover groups button */}
          <button
            type="button"
            disabled={discovering}
            onClick={() => {
              startDiscover(async () => {
                const result = await discoverAction();
                setGroups(result);
                setDiscovered(true);
              });
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-[--color-red] hover:text-white disabled:opacity-50"
          >
            {discovering ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Buscando…
              </span>
            ) : (
              "Detectar grupos"
            )}
          </button>

          {/* Discovered groups list */}
          {discovered && groups.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest text-zinc-500">
                Grupos encontrados ({groups.length})
              </p>
              {groups.map((g) => (
                <form
                  key={g.chatId}
                  action={connectAction.bind(null, launchId)}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 p-3"
                >
                  <input type="hidden" name="chatId" value={g.chatId} />
                  <div>
                    <div className="text-sm font-medium text-white">{g.title}</div>
                    <div className="text-xs text-zinc-500">
                      {g.type} · <span className="font-[family-name:var(--font-mono)]">{g.chatId}</span>
                    </div>
                  </div>
                  <SubmitButton pendingLabel="Conectando…">Conectar</SubmitButton>
                </form>
              ))}
            </div>
          )}

          {discovered && groups.length === 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
              No se encontraron grupos. Asegurate de haber agregado el bot al grupo como admin
              y haber enviado <code className="text-amber-300">/start</code> en el grupo.
            </div>
          )}

          {/* Manual fallback */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
              Conectar manualmente con Chat ID
            </summary>
            <form action={connectAction.bind(null, launchId)} className="mt-3 flex items-end gap-3">
              <label className="block flex-1">
                <span className="block text-xs uppercase tracking-widest text-zinc-400">Chat ID</span>
                <input
                  type="text"
                  name="chatId"
                  required
                  placeholder="-1001234567890"
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
                />
              </label>
              <SubmitButton pendingLabel="Conectando…">Conectar grupo</SubmitButton>
            </form>
          </details>
        </div>
      )}
    </div>
  );
}
