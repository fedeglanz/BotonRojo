"use client";

import { SubmitButton } from "@/components/admin/submit-button";
import { AiGeneratingOverlay } from "@/components/admin/ai-generating-overlay";
import { ImagePicker } from "@/components/admin/image-picker";
import { googleFontsUrl } from "@/lib/brand-kit";
import type { BrandPalette, BrandFonts, BrandKitStatus } from "@/db/schema/launches";

type Props = {
  launchId: string;
  status: BrandKitStatus;
  palette: BrandPalette | null;
  fonts: BrandFonts | null;
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
  status,
  palette,
  fonts,
  moodNotes,
  moodImageUrl,
  logoUrl,
  generateAction,
  updateAction,
  approveAction,
  logoSaveAction,
}: Props) {
  const hasKit = Boolean(palette && fonts);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-400">
          Genera una propuesta con Claude, ajústala a mano si hace falta, y apruébala. Hasta que no
          esté aprobada, no se puede generar la landing — todo lo demás se genera con esta misma
          identidad, sin improvisar colores nuevos cada vez.
        </p>
        <form action={generateAction.bind(null, launchId)}>
          <AiGeneratingOverlay
            messages={["Analizando el brief…", "Eligiendo la paleta…", "Emparejando tipografías…", "Imaginando el mood…", "Generando la imagen…"]}
          />
          <SubmitButton variant={hasKit ? "outline" : "primary"} pendingLabel="Generando…">
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
          <form action={updateAction.bind(null, launchId)} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FIELD_LABELS.map((f) => (
                <label key={f.key} className="block">
                  <span className="block text-xs uppercase tracking-widest text-zinc-400">{f.label}</span>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="color"
                      defaultValue={palette[f.key]}
                      onChange={(e) => {
                        const hidden = e.currentTarget.nextElementSibling as HTMLInputElement | null;
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
                <span className="block text-xs uppercase tracking-widest text-zinc-400">Fuente de titulares</span>
                <input
                  type="text"
                  name="displayFont"
                  defaultValue={fonts.display}
                  className="field-input mt-2 w-full px-3 py-2 text-white"
                />
              </label>
              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-zinc-400">Fuente de texto</span>
                <input
                  type="text"
                  name="bodyFont"
                  defaultValue={fonts.body}
                  className="field-input mt-2 w-full px-3 py-2 text-white"
                />
              </label>
            </div>

            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-zinc-400">Mood / dirección de imagen</span>
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

          {/* Live preview */}
          <div
            className="glass hud-corners space-y-4 p-6"
            style={{
              "--color-red": palette.primary,
              "--color-red-bright": palette.primary,
              background: palette.background,
              color: palette.foreground,
            } as React.CSSProperties}
          >
            <link rel="stylesheet" href={googleFontsUrl(fonts)} />
            <div className="text-xs uppercase tracking-widest opacity-60">Vista previa</div>
            <div style={{ fontFamily: `"${fonts.display}", sans-serif` }} className="text-3xl font-extrabold">
              Un solo botón. Tu lanzamiento entero.
            </div>
            <div style={{ fontFamily: `"${fonts.body}", sans-serif` }} className="max-w-xl text-sm opacity-80">
              Así se vería el cuerpo de texto de esta landing con la tipografía elegida.
            </div>
            <button
              type="button"
              className="rounded-full px-6 py-3 text-sm font-bold uppercase tracking-wide text-white"
              style={{ background: palette.primary }}
            >
              Botón de ejemplo
            </button>
            {moodImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={moodImageUrl} alt="Mood" className="mt-2 max-h-48 w-full rounded-lg object-cover" />
            )}
          </div>

          <ImagePicker currentUrl={logoUrl} saveAction={logoSaveAction} label="Logo (sube el tuyo — no se genera con IA)" />

          <div className="flex items-center gap-3">
            <form action={approveAction.bind(null, launchId)}>
              <SubmitButton
                variant={status === "approved" ? "outline" : "primary"}
                pendingLabel="Aprobando…"
                disabled={status === "approved"}
              >
                {status === "approved" ? "✓ Identidad visual aprobada" : "Aprobar identidad visual"}
              </SubmitButton>
            </form>
            {status === "draft" && (
              <span className="text-xs text-amber-300">Pendiente de aprobar para poder generar la landing.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
