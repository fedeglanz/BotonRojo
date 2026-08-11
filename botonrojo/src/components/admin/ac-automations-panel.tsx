"use client";

import { useState, useTransition } from "react";

type ACAutomation = {
  id: string;
  name: string;
  status: string;
  entered: string;
};

type Props = {
  launchId: string;
  automations: ACAutomation[];
  linkedAutomationIds: string[];
  linkAction: (launchId: string, automationId: string) => Promise<void>;
  unlinkAction: (launchId: string, automationId: string) => Promise<void>;
};

export function AcAutomationsPanel({
  launchId,
  automations,
  linkedAutomationIds,
  linkAction,
  unlinkAction,
}: Props) {
  const [filter, setFilter] = useState("");
  const linked = new Set(linkedAutomationIds);

  if (!automations.length) {
    return (
      <p className="text-sm text-zinc-500">
        No se encontraron automatizaciones en tu cuenta de ActiveCampaign.
        Crea una automatizacion en AC y volvera a aparecer aqui.
      </p>
    );
  }

  const filtered = filter
    ? automations.filter((a) => a.name.toLowerCase().includes(filter.toLowerCase()))
    : automations;

  const linkedFirst = [...filtered].sort((a, b) => {
    const aLinked = linked.has(a.id) ? 0 : 1;
    const bLinked = linked.has(b.id) ? 0 : 1;
    return aLinked - bLinked;
  });

  return (
    <div className="space-y-3">
      <div className="text-xs text-zinc-400">
        Asocia automatizaciones de AC a este lanzamiento. Cuando un lead entre, se lo agregara
        automaticamente a las automatizaciones vinculadas.
      </div>

      {automations.length > 5 && (
        <input
          type="text"
          placeholder="Buscar automatizacion..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
        />
      )}

      <div className="space-y-1">
        {linkedFirst.map((auto) => (
          <AutomationRow
            key={auto.id}
            automation={auto}
            isLinked={linked.has(auto.id)}
            onLink={() => linkAction(launchId, auto.id)}
            onUnlink={() => unlinkAction(launchId, auto.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && filter && (
        <p className="text-xs text-zinc-500">No hay automatizaciones que coincidan con "{filter}"</p>
      )}
    </div>
  );
}

function AutomationRow({
  automation,
  isLinked,
  onLink,
  onUnlink,
}: {
  automation: ACAutomation;
  isLinked: boolean;
  onLink: () => Promise<void>;
  onUnlink: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const isActive = automation.status === "1";

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition ${
        isLinked
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-white/5 bg-black/30"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-white">{automation.name}</span>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
              isActive
                ? "border-emerald-500/40 text-emerald-400"
                : "border-zinc-500/40 text-zinc-500"
            }`}
          >
            {isActive ? "Activa" : "Inactiva"}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-zinc-500">
          {automation.entered} contacto{automation.entered === "1" ? "" : "s"} · ID: {automation.id}
        </div>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            if (isLinked) {
              await onUnlink();
            } else {
              await onLink();
            }
          });
        }}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition ${
          pending
            ? "border-white/5 text-zinc-600"
            : isLinked
              ? "border-emerald-500/30 text-emerald-400 hover:border-red-500/30 hover:text-red-400"
              : "border-white/10 text-zinc-400 hover:border-emerald-500/30 hover:text-emerald-400"
        }`}
      >
        {pending ? "..." : isLinked ? "Desvincular" : "Vincular"}
      </button>
    </div>
  );
}
