"use client";

import { useActionState } from "react";
import { SubmitButton } from "./submit-button";
import { saveTelegramBotTokenAction, removeTelegramBotTokenAction } from "@/server/organization";

type Props = {
  currentToken: string | null;
  currentBotUsername: string | null;
};

export function TelegramTokenForm({ currentToken, currentBotUsername }: Props) {
  const [state, action] = useActionState(saveTelegramBotTokenAction, null);

  const hasToken = Boolean(currentToken);
  const masked = currentToken ? currentToken.slice(0, 6) + "••••••" + currentToken.slice(-4) : null;
  const botName = state?.ok && state.botUsername ? state.botUsername : currentBotUsername;

  return (
    <div className="space-y-4">
      {hasToken && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200">
          Bot conectado{botName ? `: @${botName}` : ""}
          <div className="mt-1 font-[family-name:var(--font-mono)] text-xs text-emerald-300/60">
            {masked}
          </div>
        </div>
      )}

      {state && !state.ok && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
          {state.error}
        </div>
      )}

      {state?.ok && state.botUsername && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-300">
          Bot @{state.botUsername} conectado correctamente.
        </div>
      )}

      <form action={action} className="space-y-3">
        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">Bot Token</span>
          <input
            type="password"
            name="botToken"
            required
            placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
            defaultValue=""
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
          />
        </label>
        <SubmitButton pendingLabel="Validando…">
          {hasToken ? "Actualizar token" : "Conectar bot"}
        </SubmitButton>
      </form>

      {hasToken && (
        <form action={removeTelegramBotTokenAction}>
          <SubmitButton variant="outline" pendingLabel="Desconectando…">
            Desconectar bot
          </SubmitButton>
        </form>
      )}

      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-300 space-y-2">
        <p className="font-medium text-white">Para obtener un Bot Token:</p>
        <ol className="list-decimal list-inside space-y-1 text-zinc-400">
          <li>Abrí Telegram y buscá <strong className="text-zinc-200">@BotFather</strong></li>
          <li>Enviá <code className="text-[--color-red-bright]">/newbot</code></li>
          <li>Elegí un nombre y un username para tu bot</li>
          <li>BotFather te va a dar un token — copialo y pegalo acá arriba</li>
        </ol>
        <p className="text-xs text-zinc-500 mt-2">
          El token tiene formato <code>123456:ABC-DEF...</code> — no lo compartas con nadie.
        </p>
      </div>
    </div>
  );
}
