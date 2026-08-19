"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SubmitButton } from "./submit-button";
import { AiGeneratingOverlay } from "./ai-generating-overlay";
import type { MediaItem } from "@/db/schema/media";

type Props = {
  items: MediaItem[];
  deleteAction: (formData: FormData) => Promise<void>;
  updateLabelAction: (formData: FormData) => Promise<void>;
  /**
   * El lanzamiento al que van las fotos que se suban o se generen aquí. Sin él
   * —en la vista de cuenta— la biblioteca es de solo consulta para lo nuevo: una
   * foto sin lanzamiento vuelve a ser el cajón común que esto venía a deshacer.
   */
  launchId?: string;
  /** Generar con Magnific, cuando está configurada. */
  generateAction?: (launchId: string, formData: FormData) => Promise<void>;
};

/** Los encuadres que Magnific sabe hacer, en el idioma de para qué sirven. */
const ENCUADRES = [
  { valor: "square", etiqueta: "Cuadrada · feed 1:1" },
  { valor: "story", etiqueta: "Vertical · story/reel 9:16" },
  { valor: "portrait", etiqueta: "Retrato · una persona" },
  { valor: "hero", etiqueta: "Panorámica · cabecera 16:9" },
  { valor: "band", etiqueta: "Banda · fondo con texto encima" },
  { valor: "card", etiqueta: "Tarjeta · 4:5" },
];

export function MediaLibraryPanel({
  items,
  deleteAction,
  updateLabelAction,
  launchId,
  generateAction,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFiles(files: FileList) {
    setError(null);
    setUploading(true);
    try {
      // Sequential rather than parallel: these are up to 8 MB each and the
      // useful feedback is "all of them landed", not raw speed.
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        if (launchId) fd.append("launchId", launchId);
        const res = await fetch("/api/media/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(`${file.name}: ${json.error ?? "upload_failed"}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-4">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/20 bg-white/[0.08] px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-200 transition hover:border-white/40 hover:bg-white/15">
          {uploading ? "Subiendo…" : "↑ Subir fotos"}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files && e.target.files.length > 0 && handleFiles(e.target.files)}
          />
        </label>
        <p className="text-xs text-zinc-500">
          JPG, PNG, WebP o AVIF · máx. 8 MB cada una. Se usan tal cual de fondo de los estáticos, sin
          que la IA las retoque.
        </p>
        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>

      {/* Pedirle una foto a Magnific. Va junto a subir y no en otra pantalla porque
          es la misma decisión —de dónde sale la foto de este anuncio— y casi ningún
          lanzamiento empieza con una sesión de fotos hecha. */}
      {launchId && generateAction && (
        <form
          action={generateAction.bind(null, launchId)}
          className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-4"
        >
          <AiGeneratingOverlay
            messages={[
              "Pintando la foto…",
              "Ajustando la luz…",
              "Afinando el detalle…",
              "Guardándola en la biblioteca…",
            ]}
          />
          <div className="text-xs uppercase tracking-widest text-zinc-400">
            O pídesela a Magnific
          </div>
          <textarea
            name="prompt"
            rows={2}
            required
            minLength={8}
            placeholder="Ej: mujer de 40 años trabajando con el portátil en una terraza al atardecer, luz cálida, ambiente mediterráneo"
            className="field-input w-full px-3 py-2 text-sm text-white"
          />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label className="block">
              <span className="block text-[10px] uppercase tracking-widest text-zinc-500">
                Encuadre
              </span>
              <select
                name="slot"
                defaultValue="square"
                className="field-input mt-1 px-3 py-2 text-sm text-white"
              >
                {ENCUADRES.map((e) => (
                  <option key={e.valor} value={e.valor}>
                    {e.etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton pendingLabel="Generando la foto…">
              Generar foto
            </SubmitButton>
          </div>
          <p className="text-xs text-zinc-500">
            Sale con la paleta y el mood de este lanzamiento, y se guarda aquí como
            una foto más. Describe la escena, no el anuncio: el texto se pone
            después encima.
          </p>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Aún no hay fotos. Sube las del cliente —retratos, en escenario, de
          producto— o pídele una a Magnific describiéndola.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((m) => (
            <div key={m.id} className="glass overflow-hidden">
              <div className="aspect-square bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.label ?? m.filename} className="h-full w-full object-cover" />
              </div>
              <div className="space-y-2 p-3">
                <form action={updateLabelAction} className="flex items-center gap-1.5">
                  <input type="hidden" name="id" value={m.id} />
                  <input
                    type="text"
                    name="label"
                    defaultValue={m.label ?? ""}
                    placeholder="Etiqueta"
                    className="field-input min-w-0 flex-1 px-2 py-1 text-xs text-white"
                  />
                  <SubmitButton variant="ghost" pendingLabel="…">
                    OK
                  </SubmitButton>
                </form>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="truncate text-[10px] text-zinc-500"
                    title={m.prompt ?? m.filename}
                  >
                    {m.source === "magnific" ? "Magnific" : m.filename}
                    {!m.launchId && " · de la cuenta"}
                  </span>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <SubmitButton variant="ghost" pendingLabel="…">
                      Borrar
                    </SubmitButton>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
