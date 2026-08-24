"use client";

import { useState } from "react";
import { SubmitButton } from "./submit-button";

/**
 * El SEO de una página: cómo se presenta fuera de la página.
 *
 * Lo que se edita aquí no se ve en la página, se ve en los tres sitios donde se
 * decide si alguien entra: el resultado de Google, la tarjeta que sale al pegar el
 * enlace en WhatsApp o en X, y la pestaña del navegador. Hasta ahora eso lo heredaba
 * del layout —"Botón Rojo · Lanzamientos"— así que una página impecable se
 * presentaba con el nombre de la herramienta con la que se hizo.
 *
 * La vista previa de arriba no es adorno: el título y la descripción se juzgan por
 * cómo se cortan, no por lo que dicen. Con los contadores al lado se ve venir el
 * corte antes de publicar.
 */
export function SeoPanel({
  pageLabel,
  publicUrl,
  seo,
  indexaPorDefecto,
  fotos,
  saveAction,
}: {
  pageLabel: string;
  publicUrl: string;
  seo: {
    title?: string;
    description?: string;
    index?: boolean;
    imageUrl?: string;
    canonicalUrl?: string;
  };
  /** Qué hace la plataforma si no se elige nada, para decirlo en vez de esconderlo. */
  indexaPorDefecto: boolean;
  /** La biblioteca del lanzamiento, para elegir la imagen de la tarjeta. */
  fotos: Array<{ url: string; etiqueta: string | null }>;
  saveAction: (formData: FormData) => Promise<void>;
}) {
  const [title, setTitle] = useState(seo.title ?? "");
  const [description, setDescription] = useState(seo.description ?? "");
  const [imageUrl, setImageUrl] = useState(seo.imageUrl ?? "");

  const dominio = publicUrl.replace(/^https?:\/\//, "").split("/")[0];
  const tituloVisto = title.trim() || pageLabel;
  const descripcionVista =
    description.trim() || "Sin descripción: Google escribirá una él.";

  const cuenta = (valor: string, ideal: number, maximo: number) => {
    const n = valor.trim().length;
    if (n === 0) return "text-zinc-600";
    if (n > maximo) return "text-red-400";
    if (n > ideal) return "text-amber-400";
    return "text-emerald-400";
  };

  return (
    <form action={saveAction} className="space-y-5">
      {/* Cómo se va a ver, con el corte real de Google. */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500">
          Así se verá en Google
        </div>
        <div className="mt-2 max-w-xl">
          <div className="truncate text-xs text-zinc-400">{dominio}</div>
          <div className="mt-0.5 truncate text-lg text-[#8ab4f8]">
            {tituloVisto}
          </div>
          <div className="mt-0.5 line-clamp-2 text-sm text-zinc-400">
            {descripcionVista}
          </div>
        </div>
      </div>

      <label className="block">
        <span className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">
            Título
          </span>
          <span
            className={`font-[family-name:var(--font-mono)] text-[10px] ${cuenta(title, 60, 70)}`}
          >
            {title.trim().length}/60
          </span>
        </span>
        <input
          type="text"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={pageLabel}
          className="field-input mt-1 w-full px-3 py-2 text-sm text-white"
        />
        <span className="mt-1 block text-xs text-zinc-500">
          Google corta sobre los 60 caracteres. Lo importante, al principio.
        </span>
      </label>

      <label className="block">
        <span className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">
            Descripción
          </span>
          <span
            className={`font-[family-name:var(--font-mono)] text-[10px] ${cuenta(description, 155, 200)}`}
          >
            {description.trim().length}/155
          </span>
        </span>
        <textarea
          name="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="La promesa del lanzamiento, en una frase que invite a entrar."
          className="field-input mt-1 w-full px-3 py-2 text-sm text-white"
        />
      </label>

      <fieldset className="rounded-lg border border-white/10 p-4">
        <legend className="px-1 text-[10px] uppercase tracking-widest text-zinc-500">
          ¿Que salga en Google?
        </legend>
        <div className="space-y-2">
          {[
            {
              valor: "",
              titulo: `Lo que decida la plataforma (ahora: ${indexaPorDefecto ? "sí se indexa" : "no se indexa"})`,
              detalle:
                "Las de venta y captación se indexan; las de gracias y baja, no — en Google no sirven de nada y diluyen la que sí quieres que salga.",
            },
            {
              valor: "si",
              titulo: "Sí, indexar",
              detalle: "Que Google la muestre en los resultados.",
            },
            {
              valor: "no",
              titulo: "No indexar",
              detalle:
                "Sigue funcionando para quien tenga el enlace, pero no aparece en las búsquedas.",
            },
          ].map((op) => (
            <label key={op.valor} className="flex cursor-pointer gap-2.5">
              <input
                type="radio"
                name="index"
                value={op.valor}
                defaultChecked={
                  op.valor === ""
                    ? seo.index === undefined
                    : op.valor === "si"
                      ? seo.index === true
                      : seo.index === false
                }
                className="mt-1"
              />
              <span>
                <span className="block text-sm text-white">{op.titulo}</span>
                <span className="block text-xs text-zinc-500">{op.detalle}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
          Imagen de la tarjeta
        </span>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            type="text"
            name="imageUrl"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://… (o elige una de la biblioteca)"
            className="field-input min-w-64 flex-1 px-3 py-2 text-sm text-white"
          />
          {fotos.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && setImageUrl(e.target.value)}
              className="field-input px-3 py-2 text-sm text-white"
            >
              <option value="">De la biblioteca…</option>
              {fotos.map((f) => (
                <option key={f.url} value={f.url}>
                  {f.etiqueta ?? f.url.split("/").pop()}
                </option>
              ))}
            </select>
          )}
        </div>
        <span className="mt-1 block text-xs text-zinc-500">
          Es la que se ve al pegar el enlace en WhatsApp, X o LinkedIn. Sin ella se
          usa la imagen de mood del lanzamiento, y si tampoco hay, el enlace sale
          pelado.
        </span>
      </label>

      <details className="rounded-lg border border-white/10 p-4">
        <summary className="cursor-pointer text-xs uppercase tracking-widest text-zinc-500">
          Canónica
        </summary>
        <label className="mt-3 block">
          <input
            type="text"
            name="canonicalUrl"
            defaultValue={seo.canonicalUrl ?? ""}
            placeholder={publicUrl}
            className="field-input w-full px-3 py-2 text-sm text-white"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Solo si esta página es una variante de otra que es la buena: le dice a
            Google que cuente los dos como uno. Vacío = ella misma ({publicUrl}).
          </span>
        </label>
      </details>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Guardando…">Guardar SEO</SubmitButton>
      </div>
    </form>
  );
}
