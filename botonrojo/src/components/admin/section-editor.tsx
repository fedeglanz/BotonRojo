"use client";

import { useState } from "react";
import { SubmitButton } from "./submit-button";
import { ImagePicker } from "./image-picker";
import { SECTION_META, type LandingSectionKey } from "@/components/public/landing-types";

type ImageSlot = {
  label: string;
  slotPath: string;
  currentUrl: string | null | undefined;
  imagePrompt?: string | null;
};

type Props = {
  launchId: string;
  section: LandingSectionKey;
  currentJson: unknown;
  preview: React.ReactNode;
  imageSlots?: ImageSlot[];
  refineAction: (launchId: string, section: LandingSectionKey, formData: FormData) => Promise<void>;
  rawUpdateAction: (launchId: string, section: LandingSectionKey, formData: FormData) => Promise<void>;
  imageSaveAction: (launchId: string, slotPath: string, formData: FormData) => Promise<void>;
};

const SUGGESTIONS: Record<LandingSectionKey, string[]> = {
  hero: [
    "Hazlo más directo y urgente",
    "Más emocional, hablando al miedo del avatar",
    "Cambia el CTA a algo menos vendedor",
  ],
  forWhom: [
    "Añade un punto más a 'sí, esto es para ti'",
    "Hazlos más específicos del avatar",
  ],
  amplifiedPromise: [
    "Más concreta y medible",
    "Más corta, menos palabras",
  ],
  painBlocks: [
    "Añade un bloque más sobre el coste de no actuar",
    "Reescribe los dolores en primera persona del avatar",
  ],
  speakers: [
    "Añade un ponente más",
    "Hazlo más enfocado en la autoridad de cada uno",
  ],
  agenda: [
    "Añade un descanso a media jornada",
    "Ajusta los horarios a un formato de medio día",
  ],
  includes: [
    "Reordena del más impactante al menos",
    "Añade 2 bonus extra",
    "Acorta las descripciones",
  ],
  pricingTiers: [
    "Hazlo sonar más exclusivo el nivel más caro",
    "Añade más bullets al nivel intermedio",
  ],
  about: [
    "Hazlo más personal y menos corporativo",
    "Añade un dato concreto de autoridad",
  ],
  testimonials: [
    "Genera 3 testimonios placeholder con perfiles distintos",
  ],
  guarantee: [
    "Más agresiva: garantía de 30 días sin preguntas",
    "Cambia la duración a 7 días",
  ],
  faq: [
    "Añade una FAQ sobre el precio",
    "Añade una FAQ sobre el tiempo necesario",
  ],
  finalCta: [
    "Más urgente, con sensación de cierre inminente",
    "Más calmado, sin urgencia falsa",
  ],
};

export function SectionEditor({
  launchId,
  section,
  currentJson,
  preview,
  imageSlots,
  refineAction,
  rawUpdateAction,
  imageSaveAction,
}: Props) {
  const [mode, setMode] = useState<"preview" | "ai" | "manual" | "images">("preview");
  const meta = SECTION_META[section];

  return (
    <div className="glass">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
        <div>
          <div className="font-[family-name:var(--font-display)] text-base font-bold text-white">
            {meta.label}
          </div>
          <div className="text-xs text-zinc-500">{meta.description}</div>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-black/40 p-1 text-xs">
          <TabButton active={mode === "preview"} onClick={() => setMode("preview")}>Preview</TabButton>
          <TabButton active={mode === "ai"} onClick={() => setMode("ai")}>✨ IA</TabButton>
          {imageSlots && imageSlots.length > 0 && (
            <TabButton active={mode === "images"} onClick={() => setMode("images")}>🖼️ Imágenes</TabButton>
          )}
          <TabButton active={mode === "manual"} onClick={() => setMode("manual")}>JSON</TabButton>
        </div>
      </header>

      {mode === "preview" && <div className="p-5">{preview}</div>}

      {mode === "ai" && (
        <div className="space-y-4 p-5">
          <form action={refineAction.bind(null, launchId, section)} className="space-y-3">
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-zinc-400">
                Dile a Claude qué cambiar en esta sección
              </span>
              <textarea
                name="instruction"
                rows={3}
                required
                minLength={3}
                placeholder={`Ej: ${SUGGESTIONS[section][0] ?? "Reescribe esta sección"}`}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS[section].map((s) => (
                <SuggestionChip key={s} label={s} />
              ))}
            </div>

            <div className="flex justify-end">
              <SubmitButton pendingLabel="Reescribiendo con Claude…">✨ Aplicar cambios</SubmitButton>
            </div>
          </form>
        </div>
      )}

      {mode === "images" && imageSlots && (
        <div className="space-y-4 p-5">
          {imageSlots.map((slot) => (
            <ImagePicker
              key={slot.slotPath}
              label={slot.label}
              currentUrl={slot.currentUrl}
              imagePrompt={slot.imagePrompt}
              saveAction={imageSaveAction.bind(null, launchId, slot.slotPath)}
            />
          ))}
        </div>
      )}

      {mode === "manual" && (
        <div className="space-y-3 p-5">
          <form action={rawUpdateAction.bind(null, launchId, section)} className="space-y-3">
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-zinc-400">
                JSON crudo (solo para esta sección)
              </span>
              <textarea
                name="json"
                rows={14}
                required
                defaultValue={JSON.stringify(currentJson ?? null, null, 2)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 p-3 font-[family-name:var(--font-mono)] text-xs text-white outline-none focus:border-[--color-red]"
              />
            </label>
            <div className="flex justify-end">
              <SubmitButton pendingLabel="Guardando…">Guardar JSON</SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 transition ${
        active
          ? "border-white/25 bg-white/20 text-white"
          : "border-transparent bg-white/[0.05] text-zinc-300 hover:border-white/15 hover:bg-white/10 hover:text-white"
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
      onClick={(e) => {
        const ta = (e.currentTarget.closest("form") as HTMLFormElement | null)?.querySelector("textarea");
        if (ta) {
          ta.value = label;
          ta.focus();
        }
      }}
      className="rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 text-xs text-zinc-200 transition hover:border-[--color-red] hover:bg-white/10 hover:text-white"
    >
      {label}
    </button>
  );
}
