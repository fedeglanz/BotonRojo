"use client";

import { useState, useTransition } from "react";
import { SubmitButton } from "./submit-button";
import { COUNTRIES, REGIONS } from "@/lib/milestone-templates";

type Milestone = {
  id: string;
  phase: string;
  label: string;
  startsAt: string;
  endsAt: string;
  sortOrder: number;
  aiWarnings: AiWarning[];
};

type AiWarning = {
  date: string;
  severity: "info" | "warning" | "critical";
  message: string;
  country?: string;
};

type AnalysisResult = {
  summary: string;
  score: number;
  warnings: AiWarning[];
  suggestions: string[];
};

type Props = {
  launchId: string;
  launchSlug: string;
  launchType: string;
  primaryCountry: string | null;
  targetRegions: string[];
  anchorDate: string | null;
  milestones: Milestone[];
  updateCountryAction: (launchId: string, formData: FormData) => Promise<void>;
  generateMilestonesAction: (launchId: string, formData: FormData) => Promise<void>;
  updateMilestoneAction: (milestoneId: string, formData: FormData) => Promise<void>;
  analyzeCalendarAction: (launchId: string) => Promise<AnalysisResult>;
  savedAnalysis: AnalysisResult | null;
};

const SEVERITY_STYLES = {
  info: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  critical: "border-red-500/30 bg-red-500/10 text-red-300",
};

const SEVERITY_ICONS = {
  info: "i",
  warning: "!",
  critical: "!!",
};

export function CalendarPanel({
  launchId,
  launchType,
  primaryCountry,
  targetRegions,
  anchorDate,
  milestones,
  updateCountryAction,
  generateMilestonesAction,
  updateMilestoneAction,
  analyzeCalendarAction,
  savedAnalysis,
}: Props) {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(savedAnalysis);
  const [analyzing, startAnalyze] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(targetRegions);
  const [selectedPrimary, setSelectedPrimary] = useState(primaryCountry ?? "");

  const handleAnalyze = () => {
    startAnalyze(async () => {
      const result = await analyzeCalendarAction(launchId);
      setAnalysis(result);
    });
  };

  const anchorLabel = launchType === "venta_directa" ? "Fecha del evento en vivo" : "Fecha de apertura de carrito";

  return (
    <div className="space-y-6">
      {/* Country selection */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-4">
        <h4 className="text-sm font-semibold text-zinc-300">Mercado objetivo</h4>

        <form action={async (fd) => { await updateCountryAction(launchId, fd); }} className="space-y-3">
          {/* Primary country */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Pais principal</label>
            <select
              name="primaryCountry"
              value={selectedPrimary}
              onChange={(e) => setSelectedPrimary(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
            >
              <option value="">Seleccionar...</option>
              {Object.entries(COUNTRIES).map(([code, name]) => (
                <option key={code} value={code}>{name} ({code})</option>
              ))}
            </select>
          </div>

          {/* Region shortcuts */}
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Regiones / paises secundarios</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {Object.entries(REGIONS).map(([key, region]) => {
                const allSelected = region.countries.every((c) => selectedCountries.includes(c));
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (allSelected) {
                        setSelectedCountries((prev) => prev.filter((c) => !region.countries.includes(c)));
                      } else {
                        setSelectedCountries((prev) => [...new Set([...prev, ...region.countries])]);
                      }
                    }}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      allSelected
                        ? "border-[var(--color-red)]/40 bg-[var(--color-red)]/10 text-[var(--color-red-bright)]"
                        : "border-white/10 text-zinc-400 hover:border-white/20"
                    }`}
                  >
                    {region.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowRegionPicker(!showRegionPicker)}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 hover:border-white/20"
              >
                {showRegionPicker ? "Cerrar" : "+ Paises"}
              </button>
            </div>

            {showRegionPicker && (
              <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-2">
                {Object.entries(COUNTRIES).map(([code, name]) => (
                  <label key={code} className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer py-0.5">
                    <input
                      type="checkbox"
                      checked={selectedCountries.includes(code)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCountries((prev) => [...prev, code]);
                        } else {
                          setSelectedCountries((prev) => prev.filter((c) => c !== code));
                        }
                      }}
                      className="accent-[var(--color-red)]"
                    />
                    {name}
                  </label>
                ))}
              </div>
            )}

            {selectedCountries.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedCountries.map((c) => (
                  <span key={c} className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                    {COUNTRIES[c] ?? c}
                    <button
                      type="button"
                      onClick={() => setSelectedCountries((prev) => prev.filter((x) => x !== c))}
                      className="ml-1 text-zinc-500 hover:text-white"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}

            <input type="hidden" name="targetRegions" value={selectedCountries.join(",")} />
          </div>

          <SubmitButton className="rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-sm hover:bg-white/10" pendingLabel="Guardando...">
            Guardar mercado
          </SubmitButton>
        </form>
      </div>

      {/* Anchor date + generate */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <h4 className="text-sm font-semibold text-zinc-300">Generar calendario</h4>
        <p className="text-xs text-zinc-500">
          Elegí la {anchorLabel.toLowerCase()} y el sistema calcula todas las fases hacia atrás. Después podés ajustar cada fecha.
        </p>
        <form action={async (fd) => { await generateMilestonesAction(launchId, fd); }} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-zinc-400 block mb-1">{anchorLabel}</label>
            <input
              type="date"
              name="anchorDate"
              defaultValue={anchorDate ?? ""}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
              required
            />
          </div>
          <SubmitButton className="rounded-lg bg-[var(--color-red)]/80 hover:bg-[var(--color-red)] px-4 py-2 text-sm font-semibold text-white" pendingLabel="Generando...">
            Generar fechas
          </SubmitButton>
        </form>
      </div>

      {/* Timeline */}
      {milestones.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-zinc-300">Calendario del lanzamiento</h4>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || !primaryCountry}
              className="rounded-lg bg-violet-600/80 hover:bg-violet-600 disabled:opacity-40 px-4 py-2 text-xs font-semibold text-white transition"
            >
              {analyzing ? "Analizando..." : "Analizar con IA"}
            </button>
          </div>

          {!primaryCountry && (
            <p className="text-xs text-amber-400">Selecciona un pais principal antes de analizar con IA.</p>
          )}

          {/* Analysis results */}
          {analysis && (
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-violet-300">Analisis IA</span>
                <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                  analysis.score >= 8 ? "bg-green-500/20 text-green-300" :
                  analysis.score >= 5 ? "bg-amber-500/20 text-amber-300" :
                  "bg-red-500/20 text-red-300"
                }`}>
                  {analysis.score}/10
                </span>
              </div>
              <p className="text-sm text-zinc-300">{analysis.summary}</p>
              {analysis.suggestions.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-zinc-400">Sugerencias:</span>
                  <ul className="list-disc list-inside space-y-1">
                    {analysis.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-zinc-300">{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Milestone cards */}
          <div className="space-y-2">
            {milestones.map((m) => (
              <MilestoneCard
                key={m.id}
                milestone={m}
                editing={editingId === m.id}
                onEdit={() => setEditingId(editingId === m.id ? null : m.id)}
                updateAction={updateMilestoneAction}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MilestoneCard({
  milestone,
  editing,
  onEdit,
  updateAction,
}: {
  milestone: Milestone;
  editing: boolean;
  onEdit: () => void;
  updateAction: (milestoneId: string, formData: FormData) => Promise<void>;
}) {
  const warnings = milestone.aiWarnings ?? [];
  const hasWarnings = warnings.length > 0;
  const maxSeverity = warnings.reduce((max, w) => {
    const order = { critical: 3, warning: 2, info: 1 };
    return order[w.severity] > order[max] ? w.severity : max;
  }, "info" as "info" | "warning" | "critical");

  const borderColor = hasWarnings
    ? maxSeverity === "critical" ? "border-red-500/30" : maxSeverity === "warning" ? "border-amber-500/30" : "border-sky-500/30"
    : "border-white/10";

  return (
    <div className={`rounded-lg border ${borderColor} bg-white/[0.02] p-3 space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-zinc-500 w-5">{String(milestone.sortOrder).padStart(2, "0")}</span>
          <span className="text-sm font-semibold text-white">{milestone.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">
            {milestone.startsAt} → {milestone.endsAt}
          </span>
          <button
            type="button"
            onClick={onEdit}
            className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-white hover:border-white/20"
          >
            {editing ? "Cerrar" : "Editar"}
          </button>
        </div>
      </div>

      {/* Warnings */}
      {hasWarnings && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className={`rounded border px-2 py-1 text-xs ${SEVERITY_STYLES[w.severity]}`}>
              <span className="font-bold mr-1">{SEVERITY_ICONS[w.severity]}</span>
              {w.message}
              {w.country && <span className="ml-1 opacity-60">({w.country})</span>}
            </div>
          ))}
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <form
          action={async (fd) => { await updateAction(milestone.id, fd); onEdit(); }}
          className="flex flex-wrap items-end gap-3 pt-2 border-t border-white/5"
        >
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Inicio</label>
            <input
              type="date"
              name="startsAt"
              defaultValue={milestone.startsAt}
              className="rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-[var(--color-red)]"
            />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-0.5">Fin</label>
            <input
              type="date"
              name="endsAt"
              defaultValue={milestone.endsAt}
              className="rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-[var(--color-red)]"
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-zinc-500 block mb-0.5">Nombre</label>
            <input
              type="text"
              name="label"
              defaultValue={milestone.label}
              className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-[var(--color-red)]"
            />
          </div>
          <SubmitButton className="rounded bg-white/5 border border-white/10 px-3 py-1 text-xs hover:bg-white/10" pendingLabel="...">
            Guardar
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
