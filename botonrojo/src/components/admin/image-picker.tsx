"use client";

import { useState, useTransition } from "react";

type UnsplashPhoto = {
  id: string;
  smallUrl: string;
  regularUrl: string;
  alt: string;
  author: string;
};

type Props = {
  currentUrl: string | null | undefined;
  imagePrompt?: string | null;
  saveAction: (formData: FormData) => Promise<void>;
  label?: string;
};

export function ImagePicker({ currentUrl, imagePrompt, saveAction, label = "Imagen" }: Props) {
  const [previewUrl, setPreviewUrl] = useState(currentUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Unsplash state
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const [unsplashQuery, setUnsplashQuery] = useState(imagePrompt ?? "");
  const [unsplashResults, setUnsplashResults] = useState<UnsplashPhoto[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "upload_failed");
      setPreviewUrl(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  async function searchUnsplash() {
    const q = unsplashQuery.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/unsplash?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al buscar");
      setUnsplashResults(data.results as UnsplashPhoto[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar en Unsplash");
    } finally {
      setSearching(false);
    }
  }

  async function generateAiImage() {
    const prompt = imagePrompt?.trim() ?? unsplashQuery.trim();
    if (!prompt) {
      setError("No hay prompt de imagen para generar");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "generation_failed");
      setPreviewUrl(data.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar imagen");
    } finally {
      setGenerating(false);
    }
  }

  function commit(url: string | null) {
    const fd = new FormData();
    fd.set("imageUrl", url ?? "");
    startTransition(async () => {
      await saveAction(fd);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-zinc-400">{label}</div>
        {imagePrompt && (
          <div className="mt-1 text-xs italic text-zinc-500">
            Sugerencia IA: <span className="text-zinc-300">{imagePrompt}</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-[200px_1fr] md:items-start">
        {/* Preview */}
        <div className="aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black/60">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-600">
              Sin imagen
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-zinc-500">URL de imagen</span>
            <input
              type="url"
              value={previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-md border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
            />
          </label>

          {/* Source buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/20 bg-white/[0.08] px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-200 transition hover:border-white/40 hover:bg-white/15 hover:text-white">
              {uploading ? "Subiendo…" : "↑ Subir archivo"}
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>

            <button
              type="button"
              onClick={() => {
                setUnsplashOpen((o) => !o);
                if (!unsplashOpen && imagePrompt) setUnsplashQuery(imagePrompt);
              }}
              className="rounded-md border border-white/20 bg-white/[0.08] px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-200 transition hover:border-white/40 hover:bg-white/15 hover:text-white"
            >
              🔍 Unsplash
            </button>

            <button
              type="button"
              onClick={generateAiImage}
              disabled={generating}
              className="rounded-md border border-white/20 bg-white/[0.08] px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-200 transition hover:border-[--color-red] hover:bg-white/15 hover:text-white disabled:opacity-50"
            >
              {generating ? "Generando IA…" : "✨ Generar con IA"}
            </button>
          </div>

          {/* Save / Remove */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => commit(previewUrl || null)}
              disabled={pending}
              className="rounded-md bg-gradient-to-b from-[#ff3849] to-[#d4172a] px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
            {currentUrl && (
              <button
                type="button"
                onClick={() => { setPreviewUrl(""); commit(null); }}
                className="text-xs uppercase tracking-widest text-zinc-500 hover:text-white"
              >
                Quitar
              </button>
            )}
          </div>

          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      </div>

      {/* Unsplash search panel */}
      {unsplashOpen && (
        <div className="mt-1 rounded-lg border border-white/10 bg-black/60 p-3 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={unsplashQuery}
              onChange={(e) => setUnsplashQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchUnsplash()}
              placeholder="Buscar en Unsplash…"
              className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white outline-none focus:border-[--color-red]"
            />
            <button
              type="button"
              onClick={searchUnsplash}
              disabled={searching}
              className="rounded-md bg-white/10 px-4 py-1.5 text-xs uppercase tracking-widest text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              {searching ? "…" : "Buscar"}
            </button>
          </div>

          {unsplashResults.length > 0 && (
            <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
              {unsplashResults.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  title={`${photo.alt || "Photo"} — ${photo.author}`}
                  onClick={() => {
                    setPreviewUrl(photo.regularUrl);
                    setUnsplashOpen(false);
                  }}
                  className="group relative aspect-video overflow-hidden rounded-lg border border-white/10 transition hover:border-[--color-red]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.smallUrl}
                    alt={photo.alt}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] text-zinc-400">
                    {photo.author}
                  </div>
                </button>
              ))}
            </div>
          )}

          {unsplashResults.length === 0 && !searching && (
            <p className="text-center text-xs text-zinc-600">
              Escribe un término y pulsa Buscar · Crédito automático a Unsplash
            </p>
          )}
        </div>
      )}
    </div>
  );
}
