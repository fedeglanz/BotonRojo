"use client";

import { useState, useTransition } from "react";

type Props = {
  currentUrl: string | null | undefined;
  imagePrompt?: string | null;
  saveAction: (formData: FormData) => Promise<void>;
  label?: string;
};

export function ImagePicker({ currentUrl, imagePrompt, saveAction, label = "Imagen" }: Props) {
  const [previewUrl, setPreviewUrl] = useState(currentUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  function commit(url: string | null) {
    const fd = new FormData();
    fd.set("imageUrl", url ?? "");
    startTransition(async () => {
      await saveAction(fd);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-400">{label}</div>
          {imagePrompt && (
            <div className="mt-1 text-xs italic text-zinc-500">
              Sugerencia IA: <span className="text-zinc-300">{imagePrompt}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[200px_1fr] md:items-start">
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

          <div className="flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-300 transition hover:border-[--color-red] hover:text-white">
              {uploading ? "Subiendo…" : "Subir archivo"}
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>
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
                onClick={() => {
                  setPreviewUrl("");
                  commit(null);
                }}
                className="text-xs uppercase tracking-widest text-zinc-500 hover:text-white"
              >
                Quitar
              </button>
            )}
          </div>

          {error && <div className="text-xs text-red-400">{error}</div>}
        </div>
      </div>
    </div>
  );
}
