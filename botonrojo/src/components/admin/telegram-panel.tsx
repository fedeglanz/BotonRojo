"use client";

import { useState, useTransition } from "react";
import { SubmitButton } from "./submit-button";

type DiscoveredGroup = { chatId: string; title: string; type: string };

const ADMIN_RIGHTS = [
  "change_info",
  "post_messages",
  "edit_messages",
  "delete_messages",
  "restrict_members",
  "invite_users",
  "pin_messages",
  "manage_video_chats",
  "promote_members",
].join("+");

type Props = {
  launchId: string;
  launchSlug: string;
  configured: boolean;
  chatId: string | null;
  inviteLink: string | null;
  botAdded: boolean;
  botUsername: string | null;
  launchName: string;
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
  botUsername,
  launchName,
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
        <code>Bot Token</code> (de @BotFather) en{" "}
        <a href="/admin/ajustes" className="underline hover:text-amber-100">Ajustes</a>.
      </div>
    );
  }

  const connected = Boolean(chatId && botAdded);

  // Deep link: opens Telegram's "create/select group" dialog with the bot pre-added as admin
  const deepLink = botUsername
    ? `https://t.me/${botUsername}?startgroup=${launchSlug}&admin=${ADMIN_RIGHTS}`
    : null;

  const suggestedGroupName = `${launchName} — Comunidad`;

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
          {/* Step-by-step with deep link */}
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-300 space-y-3">
            <p className="font-medium text-white">Conectar un grupo en 2 pasos:</p>

            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[--color-red]/20 text-xs font-bold text-[--color-red-bright]">1</span>
                <div className="space-y-2">
                  <p className="text-zinc-300">
                    Hacé click en el botón de abajo. Telegram te va a pedir crear un grupo nuevo
                    (o elegir uno existente) con el bot ya como admin.
                  </p>
                  <p className="text-xs text-zinc-500">
                    Nombre sugerido para el grupo: <strong className="text-zinc-300">{suggestedGroupName}</strong>
                  </p>
                  {deepLink ? (
                    <a
                      href={deepLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-[--color-red] px-4 py-2 text-sm font-medium text-white transition hover:bg-[--color-red]/80"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                      </svg>
                      Crear grupo en Telegram
                    </a>
                  ) : (
                    <p className="text-xs text-amber-300">
                      No se pudo obtener el username del bot. Creá el grupo manualmente y agregá el bot como admin.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[--color-red]/20 text-xs font-bold text-[--color-red-bright]">2</span>
                <div className="space-y-2">
                  <p className="text-zinc-300">
                    Una vez creado el grupo, volvé acá y detectamos el grupo automáticamente.
                  </p>
                </div>
              </div>
            </div>
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
              No se encontraron grupos. Asegurate de haber creado el grupo con el botón de arriba
              y enviado un mensaje en el grupo (puede tardar unos segundos en aparecer).
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
