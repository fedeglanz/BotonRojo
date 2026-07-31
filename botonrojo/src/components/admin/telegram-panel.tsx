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

type TelegramMessage = {
  title: string;
  body: string;
  timing: string;
  triggerEvent: string;
};

type Props = {
  launchId: string;
  launchSlug: string;
  configured: boolean;
  chatId: string | null;
  inviteLink: string | null;
  botAdded: boolean;
  botUsername: string | null;
  launchName: string;
  messages: TelegramMessage[] | null;
  connectAction: (launchId: string, formData: FormData) => Promise<void>;
  disconnectAction: (launchId: string) => Promise<void>;
  testAction: (launchId: string) => Promise<void>;
  discoverAction: () => Promise<DiscoveredGroup[]>;
  sendMessageAction: (launchId: string, messageIndex: number) => Promise<void>;
  triggerCartAction: (launchId: string, event: "on_cart_open" | "on_cart_close") => Promise<void>;
  editMessageAction: (launchId: string, messageIndex: number, formData: FormData) => Promise<void>;
  refineMessageAction: (launchId: string, messageIndex: number, formData: FormData) => Promise<void>;
};

function TriggerBadge({ event }: { event: string }) {
  const styles: Record<string, string> = {
    manual: "bg-zinc-800 text-zinc-400",
    on_lead: "bg-blue-500/10 text-blue-300",
    on_sale: "bg-emerald-500/10 text-emerald-300",
    on_cart_open: "bg-amber-500/10 text-amber-300",
    on_cart_close: "bg-amber-500/10 text-amber-300",
  };
  const labels: Record<string, string> = {
    manual: "manual",
    on_lead: "al registrarse",
    on_sale: "al comprar",
    on_cart_open: "apertura",
    on_cart_close: "cierre",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${styles[event] ?? "bg-zinc-800 text-zinc-400"}`}>
      {labels[event] ?? event}
    </span>
  );
}

function MessageCard({
  msg,
  index,
  launchId,
  sendMessageAction,
  editMessageAction,
  refineMessageAction,
}: {
  msg: TelegramMessage;
  index: number;
  launchId: string;
  sendMessageAction: Props["sendMessageAction"];
  editMessageAction: Props["editMessageAction"];
  refineMessageAction: Props["refineMessageAction"];
}) {
  const [editing, setEditing] = useState(false);
  const [refining, setRefining] = useState(false);
  const [editBody, setEditBody] = useState(msg.body);
  const [editTitle, setEditTitle] = useState(msg.title);
  const [saving, startSave] = useTransition();
  const [refiningAi, startRefine] = useTransition();

  return (
    <div className="rounded-lg border border-white/5 bg-black/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{msg.title}</span>
            <TriggerBadge event={msg.triggerEvent} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">{msg.timing}</p>

          {editing ? (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-[var(--color-red)]"
                placeholder="Titulo (admin)"
              />
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={5}
                className="w-full rounded border border-white/10 bg-black/40 px-2 py-1.5 font-[family-name:var(--font-mono)] text-xs text-white outline-none focus:border-[var(--color-red)]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    startSave(async () => {
                      const fd = new FormData();
                      fd.set("body", editBody);
                      fd.set("title", editTitle);
                      await editMessageAction(launchId, index, fd);
                      setEditing(false);
                    });
                  }}
                  className="rounded bg-[var(--color-red)] px-3 py-1 text-xs font-medium text-white transition hover:bg-[var(--color-red)]/80 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditBody(msg.body);
                    setEditTitle(msg.title);
                    setEditing(false);
                  }}
                  className="rounded border border-white/10 px-3 py-1 text-xs text-zinc-400 transition hover:text-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <p
              className="mt-1 text-xs text-zinc-400 line-clamp-2"
              dangerouslySetInnerHTML={{ __html: msg.body }}
            />
          )}

          {refining && !editing && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startRefine(async () => {
                  await refineMessageAction(launchId, index, fd);
                  setRefining(false);
                });
              }}
            >
              <input
                name="instruction"
                type="text"
                required
                placeholder="Ej: Hacelo mas urgente, agrega emojis..."
                className="flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-[var(--color-red)]"
                disabled={refiningAi}
              />
              <button
                type="submit"
                disabled={refiningAi}
                className="rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-50"
              >
                {refiningAi ? "Refinando..." : "Refinar"}
              </button>
              <button
                type="button"
                onClick={() => setRefining(false)}
                className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-400 transition hover:text-white"
              >
                X
              </button>
            </form>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <form action={sendMessageAction.bind(null, launchId, index)}>
            <SubmitButton variant="outline" pendingLabel="Enviando...">
              Enviar
            </SubmitButton>
          </form>
          {!editing && !refining && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditBody(msg.body);
                  setEditTitle(msg.title);
                  setEditing(true);
                }}
                className="rounded border border-white/10 px-2 py-1 text-[10px] text-zinc-500 transition hover:border-white/20 hover:text-zinc-300"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => setRefining(true)}
                className="rounded border border-violet-500/30 px-2 py-1 text-[10px] text-violet-400 transition hover:border-violet-500/50 hover:text-violet-300"
              >
                Mejorar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function TelegramPanel({
  launchId,
  launchSlug,
  configured,
  chatId,
  inviteLink,
  botAdded,
  botUsername,
  launchName,
  messages,
  connectAction,
  disconnectAction,
  testAction,
  discoverAction,
  sendMessageAction,
  triggerCartAction,
  editMessageAction,
  refineMessageAction,
}: Props) {
  const [groups, setGroups] = useState<DiscoveredGroup[]>([]);
  const [discovered, setDiscovered] = useState(false);
  const [discovering, startDiscover] = useTransition();

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
        Telegram no esta configurado. El admin de la organizacion debe pegar su{" "}
        <code>Bot Token</code> (de @BotFather) en{" "}
        <a href="/admin/ajustes" className="underline hover:text-amber-100">Ajustes</a>.
      </div>
    );
  }

  const connected = Boolean(chatId && botAdded);

  const addBotLink = botUsername
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
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Link de invitacion</div>
              <div className="mt-1 text-sm">
                {inviteLink ? (
                  <a
                    href={inviteLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--color-red-bright)] hover:underline break-all"
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
              <SubmitButton variant="outline" pendingLabel="Enviando...">
                Enviar mensaje de prueba
              </SubmitButton>
            </form>
            <form action={disconnectAction.bind(null, launchId)}>
              <SubmitButton variant="outline" pendingLabel="Desconectando...">
                Desconectar grupo
              </SubmitButton>
            </form>
          </div>

          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
            El bot esta conectado al grupo.
            {messages ? " Los mensajes estan listos para enviar." : " Genera mensajes con Claude usando el boton de arriba."}
          </div>

          {/* Messages list */}
          {messages && messages.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                Mensajes ({messages.length})
              </p>
              {messages.map((msg, i) => (
                <MessageCard
                  key={i}
                  msg={msg}
                  index={i}
                  launchId={launchId}
                  sendMessageAction={sendMessageAction}
                  editMessageAction={editMessageAction}
                  refineMessageAction={refineMessageAction}
                />
              ))}
            </div>
          )}

          {/* Cart triggers */}
          {messages && messages.some((m) => m.triggerEvent === "on_cart_open" || m.triggerEvent === "on_cart_close") && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                Triggers manuales
              </p>
              <div className="flex flex-wrap gap-3">
                {messages.some((m) => m.triggerEvent === "on_cart_open") && (
                  <form action={triggerCartAction.bind(null, launchId, "on_cart_open")}>
                    <SubmitButton variant="outline" pendingLabel="Enviando...">
                      Abrir carrito
                    </SubmitButton>
                  </form>
                )}
                {messages.some((m) => m.triggerEvent === "on_cart_close") && (
                  <form action={triggerCartAction.bind(null, launchId, "on_cart_close")}>
                    <SubmitButton variant="outline" pendingLabel="Enviando...">
                      Cerrar carrito
                    </SubmitButton>
                  </form>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          {/* Step-by-step guide */}
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-300 space-y-4">
            <p className="font-medium text-white">Conectar un grupo de Telegram:</p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-red)]/20 text-xs font-bold text-[var(--color-red-bright)]">1</span>
                <div>
                  <p className="text-zinc-300">Abri Telegram y crea un grupo nuevo.</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Nombre sugerido: <strong className="text-zinc-300">{suggestedGroupName}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-red)]/20 text-xs font-bold text-[var(--color-red-bright)]">2</span>
                <div className="space-y-2">
                  <p className="text-zinc-300">Agrega el bot como administrador del grupo.</p>
                  {addBotLink ? (
                    <a
                      href={addBotLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-red)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--color-red)]/80"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                      </svg>
                      Agregar bot al grupo
                    </a>
                  ) : (
                    <p className="text-xs text-zinc-400">
                      Busca <strong className="text-zinc-200">@{botUsername ?? "tu_bot"}</strong> en Telegram y agregalo como admin del grupo.
                    </p>
                  )}
                  <p className="text-xs text-zinc-500">
                    Telegram te muestra tus grupos — elegi el que acabas de crear y confirma los permisos de admin.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-red)]/20 text-xs font-bold text-[var(--color-red-bright)]">3</span>
                <p className="text-zinc-300">
                  Volve aca y hace click en <strong className="text-white">&quot;Detectar grupos&quot;</strong>.
                </p>
              </div>
            </div>
          </div>

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
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-[var(--color-red)] hover:text-white disabled:opacity-50"
          >
            {discovering ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Buscando...
              </span>
            ) : (
              "Detectar grupos"
            )}
          </button>

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
                  <SubmitButton pendingLabel="Conectando...">Conectar</SubmitButton>
                </form>
              ))}
            </div>
          )}

          {discovered && groups.length === 0 && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200">
              No se encontraron grupos. Asegurate de haber agregado el bot al grupo
              y enviado al menos un mensaje (puede tardar unos segundos).
            </div>
          )}

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
                  className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
                />
              </label>
              <SubmitButton pendingLabel="Conectando...">Conectar grupo</SubmitButton>
            </form>
          </details>
        </div>
      )}
    </div>
  );
}
