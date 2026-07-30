"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/admin/submit-button";
import type { IntegrationProvider } from "@/db/schema/integration-credentials";

type FieldSpec = { name: string; label: string; type?: string; placeholder?: string };

type ProviderSpec = {
  provider: IntegrationProvider;
  label: string;
  hint: string;
  fields: FieldSpec[];
};

export const PROVIDER_SPECS: ProviderSpec[] = [
  {
    provider: "stripe",
    label: "Stripe",
    hint: "Cada cliente cobra a sus propios compradores con su propia cuenta de Stripe.",
    fields: [
      { name: "secretKey", label: "Clave secreta", type: "password", placeholder: "sk_live_…" },
      { name: "publishableKey", label: "Clave publicable", placeholder: "pk_live_…" },
      { name: "webhookSecret", label: "Secreto del webhook", type: "password", placeholder: "whsec_…" },
    ],
  },
  {
    provider: "activecampaign",
    label: "ActiveCampaign",
    hint: "Listas, tags y plantillas de email se crean en la cuenta del propio cliente.",
    fields: [
      { name: "apiUrl", label: "URL de la API", placeholder: "https://tucuenta.api-us1.com" },
      { name: "apiKey", label: "API Key", type: "password" },
      { name: "fromName", label: "Nombre de remitente" },
      { name: "fromEmail", label: "Email de remitente", type: "email" },
    ],
  },
  {
    provider: "meta",
    label: "Meta Ads",
    hint: "Para futuras integraciones de anuncios en Meta.",
    fields: [{ name: "token", label: "Access token", type: "password" }],
  },
  {
    provider: "google_ads",
    label: "Google Ads",
    hint: "Para futuras integraciones de anuncios en Google.",
    fields: [{ name: "token", label: "Developer token", type: "password" }],
  },
  {
    provider: "telegram",
    label: "Telegram",
    hint: "Para futuros avisos/bots por Telegram.",
    fields: [{ name: "token", label: "Bot token", type: "password" }],
  },
  {
    provider: "notion",
    label: "Notion",
    hint: "Para futura sincronización de calendario/contenido.",
    fields: [{ name: "token", label: "Integration token", type: "password" }],
  },
  {
    provider: "youtube",
    label: "YouTube",
    hint: "Para futuras integraciones de clips/vídeo.",
    fields: [{ name: "token", label: "API key", type: "password" }],
  },
];

type ConnectedInfo = { maskedPreview: string; connectedAt: Date } | undefined;

export function IntegrationConnectPanel({
  connected,
  saveAction,
  disconnectAction,
}: {
  connected: Map<IntegrationProvider, ConnectedInfo>;
  saveAction: (formData: FormData) => Promise<void>;
  disconnectAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {PROVIDER_SPECS.map((spec) => (
        <ProviderCard
          key={spec.provider}
          spec={spec}
          info={connected.get(spec.provider)}
          saveAction={saveAction}
          disconnectAction={disconnectAction}
        />
      ))}
    </div>
  );
}

function ProviderCard({
  spec,
  info,
  saveAction,
  disconnectAction,
}: {
  spec: ProviderSpec;
  info: ConnectedInfo;
  saveAction: (formData: FormData) => Promise<void>;
  disconnectAction: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const isConnected = Boolean(info);

  return (
    <div className="glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">{spec.label}</div>
          <p className="mt-1 text-xs text-zinc-500">{spec.hint}</p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
            isConnected ? "border-emerald-500/40 text-emerald-300" : "border-white/10 text-zinc-500"
          }`}
        >
          {isConnected ? "Conectado" : "Sin conectar"}
        </span>
      </div>

      {isConnected && !editing && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="font-[family-name:var(--font-mono)] text-xs text-zinc-400">{info!.maskedPreview}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md border border-white/10 px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-300 hover:border-white/30 hover:text-white"
            >
              Reconectar
            </button>
            <form action={disconnectAction}>
              <input type="hidden" name="provider" value={spec.provider} />
              <SubmitButton variant="danger" pendingLabel="Desconectando…">
                Desconectar
              </SubmitButton>
            </form>
          </div>
        </div>
      )}

      {(!isConnected || editing) && (
        <form
          action={async (formData) => {
            await saveAction(formData);
            setEditing(false);
          }}
          className="mt-4 space-y-2"
        >
          <input type="hidden" name="provider" value={spec.provider} />
          {spec.fields.map((f) => (
            <label key={f.name} className="block">
              <span className="block text-[10px] uppercase tracking-widest text-zinc-500">{f.label}</span>
              <input
                type={f.type ?? "text"}
                name={f.name}
                required
                placeholder={f.placeholder}
                className="field-input mt-1 w-full px-3 py-2 text-sm text-white"
              />
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <SubmitButton pendingLabel="Guardando…">Conectar</SubmitButton>
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-xs uppercase tracking-widest text-zinc-500 hover:text-white"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
