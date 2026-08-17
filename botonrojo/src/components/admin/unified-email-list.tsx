"use client";

import { useState, useTransition } from "react";
import { SubmitButton } from "./submit-button";
import { ClaudeGoButton } from "./claude-go-button";

// ── Types ──────────────────────────────────────────────────────────────────────

type SequenceEmail = {
  subject: string;
  preheader?: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  phase?: string;
  timing?: string;
  sendOffsetDays?: number;
  approved?: boolean;
};

type DesignedCampaign = {
  id: string;
  name: string;
  subject: string;
  preheader?: string | null;
  phase?: string | null;
  sendOffsetDays?: number | null;
  timing?: string | null;
  approved?: boolean | null;
  acTemplateId?: string | null;
};

type BrandKit = {
  logoUrl?: string | null;
  palette?: { primary: string; accent: string; background: string; foreground: string } | null;
  fonts?: { display: string; body: string } | null;
};

type PhaseInfo = { phase: string; label: string };

type Props = {
  launchId: string;
  launchSlug: string;
  designMode: string;
  sequenceBody: { emails: SequenceEmail[] } | null;
  brand?: BrandKit | null;
  designedCampaigns: DesignedCampaign[];
  phases: PhaseInfo[];
  hasConnector: boolean;
  acConfigured: boolean;
  claudeUrl: string;
  claudePrompt: string;
  hasMarco: boolean;
  // Sequence actions
  refineAction: (launchId: string, emailIndex: number, formData: FormData) => Promise<void>;
  updateAction: (launchId: string, emailIndex: number, formData: FormData) => Promise<void>;
  approveAction: (launchId: string, emailIndex: number, approved: boolean) => Promise<void>;
  approveAllAction: (launchId: string) => Promise<void>;
  updateSequencePhaseAction: (launchId: string, emailIndex: number, phase: string, sendOffsetDays?: number) => Promise<void>;
  // Designed actions
  pushDesignedAction: (launchId: string, assetId: string) => Promise<void>;
  updatePhaseAction: (assetId: string, phase: string, sendOffsetDays?: number) => Promise<void>;
  approveDesignedAction: (assetId: string, approved: boolean) => Promise<void>;
};

// ── Phase config ───────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  pre_captacion: "border-blue-500/40 text-blue-400 bg-blue-500/10",
  captacion: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10",
  calentamiento: "border-amber-500/40 text-amber-400 bg-amber-500/10",
  evento_vivo: "border-red-500/40 text-red-400 bg-red-500/10",
  replay: "border-orange-500/40 text-orange-400 bg-orange-500/10",
  apertura_carrito: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
  venta: "border-green-500/40 text-green-400 bg-green-500/10",
  cierre_carrito: "border-rose-500/40 text-rose-400 bg-rose-500/10",
  urgencia: "border-red-500/40 text-red-400 bg-red-500/10",
  pre_pre_lanzamiento: "border-violet-500/40 text-violet-400 bg-violet-500/10",
  plc_1: "border-indigo-500/40 text-indigo-400 bg-indigo-500/10",
  plc_2: "border-indigo-500/40 text-indigo-400 bg-indigo-500/10",
  plc_3: "border-indigo-500/40 text-indigo-400 bg-indigo-500/10",
  plc_4: "border-indigo-500/40 text-indigo-400 bg-indigo-500/10",
};

const PHASE_LABELS: Record<string, string> = {
  pre_captacion: "Pre-captación",
  captacion: "Captación",
  calentamiento: "Calentamiento",
  evento_vivo: "Evento en vivo",
  replay: "Replay",
  apertura_carrito: "Apertura carrito",
  venta: "Venta",
  cierre_carrito: "Cierre carrito",
  urgencia: "Urgencia",
  pre_pre_lanzamiento: "Pre-pre lanzamiento",
  plc_1: "PLC 1",
  plc_2: "PLC 2",
  plc_3: "PLC 3",
  plc_4: "PLC 4",
};

const AI_SUGGESTIONS = [
  "Hazlo mas urgente",
  "Mas emocional, conecta con el dolor",
  "Acorta el texto, que sea mas directo",
  "Agrega un PS al final",
  "Cambia el asunto para mayor apertura",
];

// ── Unified email item ─────────────────────────────────────────────────────────

type UnifiedItem =
  | { source: "sequence"; index: number; email: SequenceEmail; replacedByDesigned: boolean }
  | { source: "designed"; campaign: DesignedCampaign };

function buildUnifiedList(
  sequenceBody: { emails: SequenceEmail[] } | null,
  designedCampaigns: DesignedCampaign[],
): UnifiedItem[] {
  // Phases covered by designed campaigns
  const designedPhases = new Set(
    designedCampaigns.filter((c) => c.phase).map((c) => c.phase!),
  );

  const items: UnifiedItem[] = [];

  // Add sequence emails, marking those replaced by designed ones
  if (sequenceBody?.emails) {
    for (let i = 0; i < sequenceBody.emails.length; i++) {
      const email = sequenceBody.emails[i]!;
      items.push({
        source: "sequence",
        index: i,
        email,
        replacedByDesigned: Boolean(email.phase && designedPhases.has(email.phase)),
      });
    }
  }

  // Add designed campaigns
  for (const campaign of designedCampaigns) {
    items.push({ source: "designed", campaign });
  }

  return items;
}

function getItemPhase(item: UnifiedItem): string | undefined {
  return item.source === "sequence" ? item.email.phase : (item.campaign.phase ?? undefined);
}

function getItemApproved(item: UnifiedItem): boolean {
  if (item.source === "sequence") return item.email.approved === true;
  return item.campaign.approved === true;
}

function getItemSubject(item: UnifiedItem): string {
  return item.source === "sequence" ? item.email.subject : item.campaign.subject;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function UnifiedEmailList({
  launchId,
  launchSlug,
  designMode,
  sequenceBody,
  brand,
  designedCampaigns,
  phases,
  hasConnector,
  acConfigured,
  claudeUrl,
  claudePrompt,
  hasMarco,
  refineAction,
  updateAction,
  approveAction,
  approveAllAction,
  updateSequencePhaseAction,
  pushDesignedAction,
  updatePhaseAction,
  approveDesignedAction,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<Record<string, "preview" | "ai" | "html">>({});

  const items = buildUnifiedList(sequenceBody, designedCampaigns);

  // Count approvals (only count active items, not replaced ones)
  const activeItems = items.filter(
    (it) => !(it.source === "sequence" && it.replacedByDesigned),
  );
  const approvedCount = activeItems.filter(getItemApproved).length;
  const totalCount = activeItems.length;
  const allApproved = totalCount > 0 && approvedCount === totalCount;

  // Group by phase — use all known phases so emails always land in the right group
  const allPhaseKeys = Object.keys(PHASE_LABELS);
  const grouped = new Map<string, UnifiedItem[]>();
  for (const phase of allPhaseKeys) {
    grouped.set(phase, []);
  }
  grouped.set("__none__", []);

  for (const item of items) {
    const phase = getItemPhase(item) ?? "__none__";
    const list = grouped.get(phase) ?? [];
    list.push(item);
    grouped.set(phase, list);
  }

  const getMode = (id: string) => mode[id] ?? "preview";
  const setModeFor = (id: string, m: "preview" | "ai" | "html") =>
    setMode((prev) => ({ ...prev, [id]: m }));

  const primary = brand?.palette?.primary ?? "#e63946";

  const isEmpty = !sequenceBody?.emails?.length && designedCampaigns.length === 0;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/20 px-4 py-2.5">
        <div className="flex items-center gap-4">
          <div className="text-xs text-zinc-400">
            {totalCount === 0 ? (
              "Sin emails"
            ) : (
              <>
                {approvedCount}/{totalCount} aprobados
                {allApproved && (
                  <span className="ml-2 text-emerald-400">— Listos para enviar a AC</span>
                )}
              </>
            )}
          </div>
          {totalCount > 0 && !allApproved && (
            <form action={approveAllAction.bind(null, launchId)}>
              <SubmitButton variant="ghost" pendingLabel="Aprobando...">
                Aprobar todos
              </SubmitButton>
            </form>
          )}
        </div>

        {/* Claude Design button (only in claude mode) */}
        {designMode === "claude" && (
          <ClaudeGoButton
            hasConnector={hasConnector}
            label={designedCampaigns.length === 0 ? "Disenar en Claude" : "Disenar otro"}
            href={claudeUrl}
            prompt={claudePrompt}
          />
        )}
      </div>

      {isEmpty && (
        <p className="text-sm text-zinc-500">
          Aun no hay emails. Pulsa <em>Generar emails</em> para crear la secuencia
          segun el tipo de lanzamiento
          {designMode === "claude" ? ", o diseña emails individuales en Claude." : "."}
        </p>
      )}

      {totalCount > 0 && !allApproved && (
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2 text-[11px] text-zinc-500">
          <strong className="text-zinc-400">Flujo:</strong> Abri cada email → revisalo o editalo → <em>Aprobar</em>.
          Cuando todos esten aprobados, podes enviarlos a ActiveCampaign.
          Si necesitas cambiar la fase de un email, usa el selector de fase dentro de cada uno.
          Para deshacer una aprobacion, clickea <em>Desaprobar</em>.
        </div>
      )}

      {/* Grouped by phase */}
      {Array.from(grouped.entries()).map(([phaseKey, phaseItems]) => {
        if (phaseItems.length === 0) return null;
        const isUnassigned = phaseKey === "__none__";
        const phaseLabel = isUnassigned
          ? "Sin fase asignada"
          : PHASE_LABELS[phaseKey] ?? phaseKey.replace(/_/g, " ");
        const phaseColor = isUnassigned
          ? "border-white/10 text-zinc-500"
          : PHASE_COLORS[phaseKey] ?? "border-white/10 text-zinc-400";

        return (
          <div key={phaseKey} className="space-y-2">
            {/* Phase header */}
            <div className="flex items-center gap-2 pt-2">
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-widest ${phaseColor}`}
              >
                {phaseLabel}
              </span>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            {/* Emails in this phase */}
            {phaseItems.map((item) => {
              const itemId =
                item.source === "sequence" ? `seq-${item.index}` : `des-${item.campaign.id}`;
              const isOpen = openId === itemId;
              const isReplaced = item.source === "sequence" && item.replacedByDesigned;
              const approved = getItemApproved(item);
              const subject = getItemSubject(item);

              return (
                <div
                  key={itemId}
                  className={`rounded-lg border bg-black/30 transition ${
                    isReplaced
                      ? "border-white/5 opacity-40"
                      : approved
                        ? "border-emerald-500/30"
                        : "border-white/10"
                  }`}
                >
                  {/* Header */}
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : itemId)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.source === "sequence" && (
                          <span className="font-[family-name:var(--font-mono)] text-xs text-zinc-500">
                            #{String(item.index + 1).padStart(2, "0")}
                          </span>
                        )}
                        {/* Source badge */}
                        <span
                          className={`rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-widest ${
                            item.source === "designed"
                              ? "border-violet-500/30 text-violet-400"
                              : "border-zinc-600 text-zinc-500"
                          }`}
                        >
                          {item.source === "designed" ? "Disenado" : "IA"}
                        </span>
                        {isReplaced && (
                          <span className="text-[10px] text-zinc-600">(reemplazado por diseno)</span>
                        )}
                        {approved && (
                          <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-400">
                            Aprobado
                          </span>
                        )}
                        {item.source === "designed" && item.campaign.acTemplateId && (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-300">
                            En AC
                          </span>
                        )}
                      </div>
                      <div className={`mt-0.5 truncate text-sm font-semibold ${isReplaced ? "line-through text-zinc-500" : "text-white"}`}>
                        {item.source === "designed" && item.campaign.name !== subject
                          ? `${item.campaign.name} — ${subject}`
                          : subject}
                      </div>
                      {item.source === "sequence" && item.email.timing && (
                        <div className="truncate text-xs text-zinc-500">{item.email.timing}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-zinc-500">{isOpen ? "−" : "+"}</span>
                  </button>

                  {/* Expanded content */}
                  {isOpen && !isReplaced && (
                    <div className="border-t border-white/10">
                      {item.source === "sequence" ? (
                        <SequenceEmailExpanded
                          launchId={launchId}
                          email={item.email}
                          index={item.index}
                          brand={brand}
                          primary={primary}
                          mode={getMode(itemId)}
                          setMode={(m) => setModeFor(itemId, m)}
                          refineAction={refineAction}
                          updateAction={updateAction}
                          approveAction={approveAction}
                          updateSequencePhaseAction={updateSequencePhaseAction}
                        />
                      ) : (
                        <DesignedEmailExpanded
                          launchId={launchId}
                          launchSlug={launchSlug}
                          campaign={item.campaign}
                          phases={phases}
                          acConfigured={acConfigured}
                          pushDesignedAction={pushDesignedAction}
                          updatePhaseAction={updatePhaseAction}
                          approveDesignedAction={approveDesignedAction}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Sequence email expanded ────────────────────────────────────────────────────

function SequenceEmailExpanded({
  launchId,
  email,
  index,
  brand,
  primary,
  mode,
  setMode,
  refineAction,
  updateAction,
  approveAction,
  updateSequencePhaseAction,
}: {
  launchId: string;
  email: SequenceEmail;
  index: number;
  brand?: BrandKit | null;
  primary: string;
  mode: "preview" | "ai" | "html";
  setMode: (m: "preview" | "ai" | "html") => void;
  refineAction: Props["refineAction"];
  updateAction: Props["updateAction"];
  approveAction: Props["approveAction"];
  updateSequencePhaseAction: Props["updateSequencePhaseAction"];
}) {
  const [isPending, startTransition] = useTransition();
  const isApproved = email.approved === true;

  return (
    <>
      {/* Phase selector + approve */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-4 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1">
            <TabButton active={mode === "preview"} onClick={() => setMode("preview")}>
              Preview
            </TabButton>
            <TabButton active={mode === "ai"} onClick={() => setMode("ai")}>
              ✨ IA
            </TabButton>
            <TabButton active={mode === "html"} onClick={() => setMode("html")}>
              Editar
            </TabButton>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest text-zinc-600">Fase:</span>
            <select
              value={email.phase ?? ""}
              onChange={(e) => {
                const phase = e.target.value;
                startTransition(async () => {
                  await updateSequencePhaseAction(
                    launchId,
                    index,
                    phase,
                    email.sendOffsetDays,
                  );
                });
              }}
              disabled={isPending}
              className="rounded border border-white/10 bg-black/60 px-2 py-1 text-[11px] text-white outline-none focus:border-white/30"
            >
              <option value="">Sin fase</option>
              {Object.entries(PHASE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <form action={approveAction.bind(null, launchId, index, !isApproved)}>
          <SubmitButton
            variant={isApproved ? "outline" : "primary"}
            pendingLabel={isApproved ? "Desaprobando..." : "Aprobando..."}
          >
            {isApproved ? "Desaprobar" : "Aprobar"}
          </SubmitButton>
        </form>
      </div>

      {/* Preview */}
      {mode === "preview" && (
        <div className="p-4">
          <div
            className="mx-auto max-w-xl overflow-hidden rounded-lg border border-white/10"
            style={{ backgroundColor: brand?.palette?.background ?? "#ffffff" }}
          >
            {brand?.logoUrl && (
              <div className="py-6 text-center">
                <img src={brand.logoUrl} alt="" className="mx-auto h-10 max-w-[180px] object-contain" />
              </div>
            )}
            <div
              className="border-b px-6 py-3"
              style={{
                borderColor: `${brand?.palette?.foreground ?? "#1a1a1a"}15`,
                color: brand?.palette?.foreground ?? "#1a1a1a",
              }}
            >
              <div className="text-xs opacity-50">Asunto:</div>
              <div className="text-sm font-semibold" style={{ fontFamily: brand?.fonts?.display ?? "Arial, sans-serif" }}>
                {email.subject}
              </div>
              {email.preheader && <div className="mt-1 text-xs opacity-40">{email.preheader}</div>}
            </div>
            <div
              className="px-6 py-5"
              style={{
                color: brand?.palette?.foreground ?? "#1a1a1a",
                fontFamily: brand?.fonts?.body ?? "Arial, sans-serif",
                fontSize: "15px",
                lineHeight: "1.6",
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: email.body }} />
            </div>
            {email.ctaText && (
              <div className="px-6 pb-6 text-center">
                <span
                  className="inline-block rounded-md px-7 py-3 text-xs font-bold uppercase tracking-widest text-white"
                  style={{ backgroundColor: primary, fontFamily: brand?.fonts?.display ?? "Arial, sans-serif" }}
                >
                  {email.ctaText}
                </span>
              </div>
            )}
            <div
              className="border-t px-6 py-4 text-center text-[11px] opacity-40"
              style={{ borderColor: `${brand?.palette?.foreground ?? "#1a1a1a"}10` }}
            >
              Cancelar suscripcion
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(email.body)}
              className="inline-flex rounded-full border border-white/10 px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-400 transition hover:text-white"
            >
              Copiar HTML
            </button>
          </div>
        </div>
      )}

      {/* AI refine */}
      {mode === "ai" && (
        <div className="space-y-4 p-4">
          <form action={refineAction.bind(null, launchId, index)} className="space-y-3">
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-zinc-400">
                Decile a Claude que cambiar en este email
              </span>
              <textarea
                name="instruction"
                rows={3}
                required
                minLength={3}
                placeholder="Ej: Hazlo mas urgente, agrega escasez"
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {AI_SUGGESTIONS.map((s) => (
                <SuggestionChip key={s} label={s} />
              ))}
            </div>
            <div className="flex justify-end">
              <SubmitButton variant="ghost" pendingLabel="Refinando...">
                Refinar con Claude
              </SubmitButton>
            </div>
          </form>
        </div>
      )}

      {/* Manual edit */}
      {mode === "html" && (
        <div className="p-4">
          <form action={updateAction.bind(null, launchId, index)} className="space-y-3">
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-zinc-400">Asunto</span>
              <input
                name="subject"
                type="text"
                defaultValue={email.subject}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
              />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-zinc-400">Preheader</span>
              <input
                name="preheader"
                type="text"
                defaultValue={email.preheader ?? ""}
                maxLength={90}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
              />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-zinc-400">Body (HTML)</span>
              <textarea
                name="body"
                rows={12}
                defaultValue={email.body}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-white outline-none focus:border-[var(--color-red)]"
              />
            </label>
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-zinc-400">Texto del CTA</span>
              <input
                name="ctaText"
                type="text"
                defaultValue={email.ctaText ?? ""}
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
              />
            </label>
            <div className="flex justify-end">
              <SubmitButton variant="ghost" pendingLabel="Guardando...">
                Guardar cambios
              </SubmitButton>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

// ── Designed email expanded ────────────────────────────────────────────────────

function DesignedEmailExpanded({
  launchId,
  launchSlug,
  campaign,
  phases,
  acConfigured,
  pushDesignedAction,
  updatePhaseAction,
  approveDesignedAction,
}: {
  launchId: string;
  launchSlug: string;
  campaign: DesignedCampaign;
  phases: PhaseInfo[];
  acConfigured: boolean;
  pushDesignedAction: Props["pushDesignedAction"];
  updatePhaseAction: Props["updatePhaseAction"];
  approveDesignedAction: Props["approveDesignedAction"];
}) {
  const [isPending, startTransition] = useTransition();
  const isApproved = campaign.approved === true;

  return (
    <div className="space-y-4 p-4">
      {/* Phase selector */}
      <div className="flex flex-wrap items-end gap-4">
        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-zinc-500">Fase</span>
          <select
            value={campaign.phase ?? ""}
            onChange={(e) => {
              const phase = e.target.value;
              startTransition(async () => {
                await updatePhaseAction(
                  campaign.id,
                  phase,
                  campaign.sendOffsetDays ?? undefined,
                );
              });
            }}
            disabled={isPending}
            className="mt-1 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
          >
            <option value="">Sin fase</option>
            {Object.entries(PHASE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-zinc-500">
            Offset (dias)
          </span>
          <input
            type="number"
            defaultValue={campaign.sendOffsetDays ?? 0}
            className="mt-1 w-20 rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-xs text-white outline-none focus:border-white/30"
            onBlur={(e) => {
              const val = Number(e.target.value);
              if (val !== (campaign.sendOffsetDays ?? 0)) {
                startTransition(async () => {
                  await updatePhaseAction(campaign.id, campaign.phase ?? "", val);
                });
              }
            }}
            disabled={isPending}
          />
        </label>
      </div>

      {/* Actions row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Approve */}
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await approveDesignedAction(campaign.id, !isApproved);
            })
          }
          disabled={isPending}
          className={`rounded-md border px-3 py-1.5 text-xs transition ${
            isApproved
              ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              : "border-white/10 text-zinc-400 hover:text-white"
          }`}
        >
          {isPending ? "..." : isApproved ? "Desaprobar" : "Aprobar"}
        </button>

        {/* Push to AC */}
        {acConfigured && !campaign.acTemplateId && (
          <form action={pushDesignedAction.bind(null, launchId, campaign.id)}>
            <SubmitButton variant="ghost" pendingLabel="Subiendo...">
              Subir a AC
            </SubmitButton>
          </form>
        )}

        {/* Preview link */}
        <a
          href={`/admin/lanzamientos/${launchSlug}/campanas/${campaign.id}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] uppercase tracking-widest text-zinc-300 transition hover:border-white/40"
        >
          Ver ↗
        </a>
      </div>

      {campaign.preheader && (
        <div className="text-xs text-zinc-500">
          <span className="text-zinc-600">Preheader:</span> {campaign.preheader}
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs transition ${
        active ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}

function SuggestionChip({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 transition hover:border-white/30 hover:text-white"
      onClick={(e) => {
        const form = e.currentTarget.closest("form");
        const textarea = form?.querySelector("textarea[name=instruction]") as HTMLTextAreaElement | null;
        if (textarea) {
          textarea.value = label;
          textarea.focus();
        }
      }}
    >
      {label}
    </button>
  );
}
