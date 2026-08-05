"use client";

import { useState, useTransition } from "react";

import { SubmitButton } from "./submit-button";

type TokenRow = {
  id: string;
  label: string;
  tokenHint: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

/**
 * Connector tokens.
 *
 * A client component because the token has to be shown exactly once, right after
 * minting: it's never stored in the clear, so there is no screen that can show it
 * again later. That single moment is worth the interactivity.
 */
export function McpTokensPanel({
  tokens,
  connectorUrl,
  createAction,
  revokeAction,
}: {
  tokens: TokenRow[];
  connectorUrl: string;
  createAction: (formData: FormData) => Promise<string>;
  revokeAction: (formData: FormData) => Promise<void>;
}) {
  const [fresh, setFresh] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState<"token" | "url" | null>(null);

  function copy(text: string, what: "token" | "url") {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-black/30 p-5">
        <div className="text-xs uppercase tracking-widest text-zinc-400">
          URL del conector
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <code className="min-w-0 flex-1 truncate rounded-md bg-black/50 px-3 py-2 font-[family-name:var(--font-mono)] text-sm text-zinc-200">
            {connectorUrl}
          </code>
          <button
            type="button"
            onClick={() => copy(connectorUrl, "url")}
            className="shrink-0 rounded-md border border-white/15 px-3 py-2 text-xs uppercase tracking-widest text-zinc-300 transition hover:border-white/40"
          >
            {copied === "url" ? "Copiada" : "Copiar"}
          </button>
        </div>
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        action={(formData) => {
          start(async () => {
            const token = await createAction(formData);
            setFresh(token);
          });
        }}
      >
        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">
            Nombre del token
          </span>
          <span className="mt-1 block text-xs text-zinc-500">
            Para saber de quién es. Por ejemplo: “Claude de Ana”.
          </span>
          <input
            name="label"
            placeholder="Claude"
            className="field-input mt-2 px-3 py-2 text-sm text-white"
          />
        </label>
        <SubmitButton variant="ghost" pendingLabel="Creando…">
          Crear token
        </SubmitButton>
        {pending && <span className="text-xs text-zinc-500">Creando…</span>}
      </form>

      {fresh && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-5">
          <div className="text-xs uppercase tracking-widest text-emerald-300">
            Cópialo ahora
          </div>
          <p className="mt-1 text-sm text-zinc-300">
            No se guarda en claro en ningún sitio, así que esta es la única vez
            que se puede ver. Si se pierde, se crea otro y se revoca este.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <code className="min-w-0 flex-1 break-all rounded-md bg-black/60 px-3 py-2 font-[family-name:var(--font-mono)] text-sm text-emerald-200">
              {fresh}
            </code>
            <button
              type="button"
              onClick={() => copy(fresh, "token")}
              className="shrink-0 rounded-md border border-emerald-400/40 px-3 py-2 text-xs uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-400/10"
            >
              {copied === "token" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {tokens.map((t) => (
          <li
            key={t.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.revokedAt ? "bg-zinc-600" : "bg-emerald-400"}`}
            />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-white">{t.label}</div>
              <div className="truncate font-[family-name:var(--font-mono)] text-[11px] text-zinc-500">
                {t.tokenHint}
                {t.lastUsedAt
                  ? ` · usado el ${new Date(t.lastUsedAt).toLocaleDateString("es")}`
                  : " · sin usar todavía"}
                {t.revokedAt && " · revocado"}
              </div>
            </div>
            {!t.revokedAt && (
              <form action={revokeAction}>
                <input type="hidden" name="id" value={t.id} />
                <SubmitButton variant="danger" pendingLabel="Revocando…">
                  Revocar
                </SubmitButton>
              </form>
            )}
          </li>
        ))}
        {!tokens.length && (
          <li className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-zinc-500">
            Todavía no hay ningún token. Crea uno para conectar Claude.
          </li>
        )}
      </ul>
    </div>
  );
}
