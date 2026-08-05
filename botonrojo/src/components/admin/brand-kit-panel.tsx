"use client";

import { SubmitButton } from "@/components/admin/submit-button";
import { AiGeneratingOverlay } from "@/components/admin/ai-generating-overlay";
import { ImagePicker } from "@/components/admin/image-picker";
import { BrandPreview } from "@/components/admin/brand-preview";
import { googleFontsUrl } from "@/lib/brand-kit";
import type {
  BrandPalette,
  BrandFonts,
  BrandKitStatus,
  BrandDesign,
} from "@/db/schema/launches";
import {
  BRAND_DESIGN_LABELS,
  BRAND_DESIGN_OPTIONS,
  defaultBrandDesign,
} from "@/lib/design/brand-design";

type Props = {
  launchId: string;
  /** False when the launch has no brief: generating would throw. */
  canGenerate?: boolean;
  status: BrandKitStatus;
  palette: BrandPalette | null;
  fonts: BrandFonts | null;
  design: BrandDesign | null;
  moodNotes: string | null;
  moodImageUrl: string | null;
  logoUrl: string | null;
  generateAction: (launchId: string) => Promise<void>;
  updateAction: (launchId: string, formData: FormData) => Promise<void>;
  approveAction: (launchId: string) => Promise<void>;
  logoSaveAction: (formData: FormData) => Promise<void>;
};

const FIELD_LABELS: { key: keyof BrandPalette; label: string }[] = [
  { key: "primary", label: "Primario / CTA" },
  { key: "accent", label: "Acento" },
  { key: "background", label: "Fondo" },
  { key: "foreground", label: "Texto" },
];

export function BrandKitPanel({
  launchId,
  canGenerate = true,
  status,
  palette,
  fonts,
  design,
  moodNotes,
  moodImageUrl,
  logoUrl,
  generateAction,
  updateAction,
  approveAction,
  logoSaveAction,
}: Props) {
  const hasKit = Boolean(palette && fonts);
  // A kit generated before these decisions existed has no design yet; fall back
  // to the palette-appropriate default so the controls always show something
  // truthful rather than empty.
  const effectiveDesign = design ?? defaultBrandDesign(palette);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          Genera una propuesta con Claude, ajústala a mano si hace falta, y
          apruébala. Hasta que no esté aprobada, no se puede generar la landing
          — todo lo demás se genera con esta misma identidad, sin improvisar
          colores nuevos cada vez.
        </p>
        <form
          action={generateAction.bind(null, launchId)}
          className="space-y-2"
        >
          <AiGeneratingOverlay
            messages={[
              "Analizando el brief…",
              "Eligiendo la paleta…",
              "Emparejando tipografías…",
              "Imaginando el mood…",
              "Generando la imagen…",
            ]}
          />
          {!canGenerate && (
            <p className="text-xs text-amber-300">
              Escribe primero el brief: la identidad visual se propone a partir
              de él.
            </p>
          )}
          <SubmitButton
            variant={hasKit ? "outline" : "primary"}
            pendingLabel="Generando…"
            disabled={!canGenerate}
          >
            {hasKit ? "Regenerar con Claude" : "Generar con Claude"}
          </SubmitButton>
        </form>
      </div>

      {!hasKit && (
        <p className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-zinc-500">
          Aún no hay identidad visual para este lanzamiento.
        </p>
      )}

      {hasKit && palette && fonts && (
        <>
          <form
            action={updateAction.bind(null, launchId)}
            className="space-y-6"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FIELD_LABELS.map((f) => (
                <label key={f.key} className="block">
                  <span className="block text-xs uppercase tracking-widest text-zinc-400">
                    {f.label}
                  </span>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="color"
                      defaultValue={palette[f.key]}
                      onChange={(e) => {
                        const hidden = e.currentTarget
                          .nextElementSibling as HTMLInputElement | null;
                        if (hidden) hidden.value = e.currentTarget.value;
                      }}
                      className="h-9 w-9 shrink-0 cursor-pointer rounded border border-white/10 bg-transparent"
                    />
                    <input
                      type="text"
                      name={f.key}
                      defaultValue={palette[f.key]}
                      className="field-input w-full px-3 py-2 font-[family-name:var(--font-mono)] text-sm text-white"
                    />
                  </div>
                </label>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-zinc-400">
                  Fuente de titulares
                </span>
                <input
                  type="text"
                  name="displayFont"
                  defaultValue={fonts.display}
                  className="field-input mt-2 w-full px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-zinc-400">
                  Fuente de texto
                </span>
                <input
                  type="text"
                  name="bodyFont"
                  defaultValue={fonts.body}
                  className="field-input mt-2 w-full px-3 py-2 text-white"
                />
              </label>
            </div>

            {/* The design system: decided once here and applied to every page of
                the launch, instead of each generation improvising it. */}
            <div className="space-y-3 border-t border-white/10 pt-5">
              <div>
                <div className="text-xs uppercase tracking-widest text-zinc-400">
                  Sistema de diseño
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Se aplica a todas las páginas del lanzamiento. La IA propone;
                  tú decides.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <DesignChoice
                  name="cardStyle"
                  label="Cajas"
                  current={effectiveDesign.cardStyle}
                  group="cardStyle"
                />
                <DesignChoice
                  name="ctaStyle"
                  label="Botón principal"
                  current={effectiveDesign.ctaStyle}
                  group="ctaStyle"
                />
                <DesignChoice
                  name="density"
                  label="Densidad"
                  current={effectiveDesign.density}
                  group="density"
                />
                <DesignChoice
                  name="titleFx"
                  label="Titulares"
                  current={effectiveDesign.titleFx}
                  group="titleFx"
                />
                <DesignChoice
                  name="divider"
                  label="Transición entre bandas"
                  current={effectiveDesign.divider}
                  group="divider"
                />
                <DesignChoice
                  name="intensity"
                  label="Nivel de decoración"
                  current={effectiveDesign.intensity}
                  group="intensity"
                />
              </div>

              <fieldset>
                <legend className="text-xs uppercase tracking-widest text-zinc-400">
                  Efectos que encajan con esta marca
                </legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  {BRAND_DESIGN_OPTIONS.effects.map((effect) => (
                    <label
                      key={effect}
                      className="flex items-center gap-2 text-sm text-zinc-300"
                    >
                      <input
                        type="checkbox"
                        name="effects"
                        value={effect}
                        defaultChecked={effectiveDesign.effects.includes(
                          effect,
                        )}
                        className="h-4 w-4 rounded border-white/20 bg-black/40"
                      />
                      {BRAND_DESIGN_LABELS.effects[effect]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-zinc-400">
                Mood / dirección de imagen
              </span>
              <textarea
                name="moodNotes"
                defaultValue={moodNotes ?? ""}
                rows={2}
                className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
              />
            </label>

            <SubmitButton variant="ghost" pendingLabel="Guardando…">
              Guardar cambios
            </SubmitButton>
          </form>

          {/* Previews the whole system, not just the palette — see BrandPreview. */}
          <BrandPreview
            palette={palette}
            fonts={fonts}
            design={effectiveDesign}
            moodImageUrl={moodImageUrl}
          />

          <ImagePicker
            currentUrl={logoUrl}
            saveAction={logoSaveAction}
            label="Logo (sube el tuyo — no se genera con IA)"
          />

          <div className="flex items-center gap-3">
            <form action={approveAction.bind(null, launchId)}>
              <SubmitButton
                variant={status === "approved" ? "outline" : "primary"}
                pendingLabel="Aprobando…"
                disabled={status === "approved"}
              >
                {status === "approved"
                  ? "✓ Identidad visual aprobada"
                  : "Aprobar identidad visual"}
              </SubmitButton>
            </form>
            {status === "draft" && (
              <span className="text-xs text-amber-300">
                Pendiente de aprobar para poder generar la landing.
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * One design decision. A select rather than a swatch grid on purpose: the labels
 * say what each option does, which matters more than a thumbnail when the choice
 * is "how loud is this page".
 */
function DesignChoice<
  K extends
    | "cardStyle"
    | "ctaStyle"
    | "density"
    | "titleFx"
    | "divider"
    | "intensity",
>({
  name,
  label,
  current,
  group,
}: {
  name: string;
  label: string;
  current: string;
  group: K;
}) {
  const options = BRAND_DESIGN_OPTIONS[group] as readonly string[];
  const labels = BRAND_DESIGN_LABELS[group] as Record<string, string>;

  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-zinc-400">
        {label}
      </span>
      <select
        name={name}
        defaultValue={current}
        className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
      >
        {options.map((option) => (
          <option key={option} value={option} className="bg-zinc-900">
            {labels[option] ?? option}
          </option>
        ))}
      </select>
    </label>
  );
}
