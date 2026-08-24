"use client";

import { useState } from "react";
import { SubmitButton } from "./submit-button";
import { AiGeneratingOverlay } from "./ai-generating-overlay";
import { AD_FORMAT_LIST, AD_TEMPLATES } from "@/lib/ad-templates";
import type { AdStaticConcept, AdImageBody } from "./ads-types";
import type { MediaItem } from "@/db/schema/media";
import type { Asset } from "@/db/schema/assets";

type Props = {
  launchId: string;
  concepts: AdStaticConcept[];
  mediaItems: MediaItem[];
  adImages: Asset[];
  generateAction: (launchId: string, formData: FormData) => Promise<void>;
  deleteAction: (launchId: string, formData: FormData) => Promise<void>;
};

export function AdStaticsGenerator({
  launchId,
  concepts,
  mediaItems,
  adImages,
  generateAction,
  deleteAction,
}: Props) {
  const [conceptIndex, setConceptIndex] = useState(0);
  const [mediaItemId, setMediaItemId] = useState(mediaItems[0]?.id ?? "");

  const selected = concepts[conceptIndex];

  // Lo que falta para poder componer con plantilla, si falta algo. La galería se
  // enseña igualmente: los anuncios diseñados en Claude llegan sin pasar por aquí,
  // y devolviendo solo el aviso quedaban publicados y sin ningún sitio donde verlos.
  const bloqueo =
    concepts.length === 0 ? (
      <p className="rounded-lg border border-white/10 bg-black/30 p-4 text-sm text-zinc-500">
        Regenera los anuncios para obtener conceptos de estático con los que
        componer imágenes.
      </p>
    ) : mediaItems.length === 0 ? (
      <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
        Hacen falta fotos. Súbelas o pídele una a Magnific ahí arriba, en las
        fotos de este lanzamiento: se usan de fondo de los estáticos, tal cual,
        sin retocar.
      </p>
    ) : null;

  return (
    <div className="space-y-5">
      {bloqueo}
      {!bloqueo && (
        <form
          action={generateAction.bind(null, launchId)}
          className="space-y-5 rounded-lg border border-white/10 bg-black/30 p-4"
        >
          <AiGeneratingOverlay
            messages={[
              "Componiendo el estático…",
              "Colocando el texto sobre la foto…",
              "Exportando cada formato…",
            ]}
          />

          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-400">
              1. Concepto
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {concepts.map((c, i) => (
                <label
                  key={i}
                  className={`cursor-pointer rounded-lg border p-3 transition ${
                    conceptIndex === i
                      ? "border-[var(--color-red)] bg-[var(--color-red)]/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/25"
                  }`}
                >
                  <input
                    type="radio"
                    name="conceptIndex"
                    value={i}
                    checked={conceptIndex === i}
                    onChange={() => setConceptIndex(i)}
                    className="sr-only"
                  />
                  <div className="text-sm font-bold text-white">
                    {c.concept ?? `Concepto ${i + 1}`}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">{c.headline}</div>
                  {c.template && (
                    <div className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">
                      {AD_TEMPLATES[c.template]?.label ?? c.template}
                    </div>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-400">
              2. Foto de fondo
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
              {mediaItems.map((m) => (
                <label
                  key={m.id}
                  title={m.label ?? m.filename}
                  className={`relative aspect-square cursor-pointer overflow-hidden rounded-lg border-2 transition ${
                    mediaItemId === m.id
                      ? "border-[var(--color-red)]"
                      : "border-transparent hover:border-white/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="mediaItemId"
                    value={m.id}
                    checked={mediaItemId === m.id}
                    onChange={() => setMediaItemId(m.id)}
                    className="sr-only"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url}
                    alt={m.label ?? ""}
                    className="h-full w-full object-cover"
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-400">
              3. Formatos
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {AD_FORMAT_LIST.map((f) => (
                <label
                  key={f.key}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5 text-sm text-zinc-200"
                >
                  <input
                    type="checkbox"
                    name="formats"
                    value={f.key}
                    defaultChecked={
                      f.key === "meta_feed_1x1" || f.key === "meta_story_9x16"
                    }
                    className="h-4 w-4 accent-[var(--color-red-bright)]"
                  />
                  <span>
                    {f.label}
                    <span className="ml-1 font-[family-name:var(--font-mono)] text-[10px] text-zinc-500">
                      {f.width}×{f.height}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Google Search es solo texto — está en la pestaña &ldquo;Google
              Search&rdquo; de arriba, no genera imagen.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-zinc-500">
              Se usará &ldquo;
              {selected?.concept ?? `Concepto ${conceptIndex + 1}`}&rdquo; sobre
              la foto marcada.
            </div>
            <SubmitButton pendingLabel="Generando estáticos…">
              Generar estáticos
            </SubmitButton>
          </div>
        </form>
      )}

      {adImages.length > 0 && (
        <div>
          <div className="mb-2 text-xs uppercase tracking-widest text-zinc-400">
            Estáticos · {adImages.length}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {adImages.map((img) => {
              const meta = img.body as unknown as AdImageBody;
              return (
                <div key={img.id} className="glass overflow-hidden">
                  {img.fileUrl && (
                    <a
                      href={img.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block bg-black/40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.fileUrl}
                        alt={img.title}
                        className="h-40 w-full object-contain"
                      />
                    </a>
                  )}
                  <div className="space-y-2 p-3">
                    <div className="text-xs font-bold text-white">
                      {img.title}
                    </div>
                    <div className="font-[family-name:var(--font-mono)] text-[10px] text-zinc-500">
                      {meta?.width}×{meta?.height}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(img.body as { designUrl?: string })?.designUrl && (
                        <a
                          href={(img.body as { designUrl?: string }).designUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[10px] uppercase tracking-widest text-emerald-300 transition hover:bg-emerald-400/20"
                        >
                          Abrir en Claude ↗
                        </a>
                      )}
                      {img.fileUrl && (
                        <a
                          href={img.fileUrl}
                          download
                          className="rounded-md border border-white/20 bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-widest text-zinc-200 transition hover:border-white/40 hover:bg-white/10"
                        >
                          Descargar
                        </a>
                      )}
                      <form action={deleteAction.bind(null, launchId)}>
                        <input type="hidden" name="assetId" value={img.id} />
                        <SubmitButton variant="ghost" pendingLabel="…">
                          Borrar
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
