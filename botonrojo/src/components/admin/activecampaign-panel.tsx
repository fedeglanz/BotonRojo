"use client";

import { useState } from "react";
import { SubmitButton } from "./submit-button";
import { Button } from "@/components/ui/button";

import { acTagsFor } from "@/lib/ac-tags";

type PushResult = {
  ok: boolean;
  created: number;
  total: number;
  errors: Array<{ index: number; subject: string; reason: string }>;
};

type Opcion = { id: number; nombre: string };

type Props = {
  launchId: string;
  launchSlug: string;
  /** Decide qué se etiqueta: una newsletter solo tiene suscrito y desuscrito. */
  launchType: string;
  configured: boolean;
  listId: number | null;
  tagIds: Record<string, number>;
  /** Lo que ya existe en la cuenta de ActiveCampaign, para elegir. */
  listasExistentes: Opcion[];
  etiquetasExistentes: Opcion[];
  /**
   * Si se ha podido leer la cuenta. Sin esto, un corte de red daría por eliminadas
   * las etiquetas de alguien, que es un susto tonto y evitable.
   */
  catalogoLeido: boolean;
  linkAction: (launchId: string, formData: FormData) => Promise<void>;
  hasEmails: boolean;
  emailAssetId: string | null;
  hasTemplates: boolean;
  hasCampaigns: boolean;
  hasMilestones: boolean;
  pushEmailsAction: (launchId: string, assetId: string) => Promise<PushResult>;
  scheduleCampaignsAction: (launchId: string) => Promise<void>;
};

export function ActiveCampaignPanel({
  launchId,
  launchSlug,
  launchType,
  configured,
  listId,
  tagIds,
  listasExistentes,
  etiquetasExistentes,
  catalogoLeido,
  linkAction,
  hasEmails,
  emailAssetId,
  hasTemplates,
  hasCampaigns,
  hasMilestones,
  pushEmailsAction,
  scheduleCampaignsAction,
}: Props) {
  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
        ActiveCampaign no esta configurado. Agrega{" "}
        <code>ACTIVECAMPAIGN_API_URL</code> y{" "}
        <code>ACTIVECAMPAIGN_API_KEY</code> en <code>.env</code> y reinicia la
        app.
      </div>
    );
  }

  const CLAVES = acTagsFor(launchType);
  const provisioned = Boolean(listId);

  // Se resuelve contra lo que hay ahora en la cuenta. Solo se afirma que algo se ha
  // borrado si de verdad se ha podido preguntar.
  const nombreDeLista = listId
    ? listasExistentes.find((l) => l.id === listId)?.nombre
    : undefined;

  const desaparecidas = !catalogoLeido
    ? []
    : [
        listId && !nombreDeLista ? `la lista #${listId}` : null,
        ...CLAVES.map((c) => {
          const id = tagIds[c.key];
          if (!id) return null;
          return etiquetasExistentes.some((t) => t.id === id)
            ? null
            : `la etiqueta de ${c.label.toLowerCase()} (#${id})`;
        }),
      ].filter((x): x is string => Boolean(x));
  const canSchedule = provisioned && hasTemplates && hasMilestones;
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [pushing, setPushing] = useState(false);

  async function handlePushEmails() {
    if (!emailAssetId) return;
    setPushing(true);
    setPushResult(null);
    try {
      const result = await pushEmailsAction(launchId, emailAssetId);
      setPushResult(result);
    } catch (err) {
      setPushResult({
        ok: false,
        created: 0,
        total: 0,
        errors: [{ index: 0, subject: "", reason: err instanceof Error ? err.message : "Error desconocido" }],
      });
    } finally {
      setPushing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* El nombre que se enseña es el que tiene AHORA en ActiveCampaign, no el que
          le pusimos al crearla: si allí la renombran, aquí se lee renombrada, y si la
          borran, se dice. Antes esto pintaba `slug-clave`, un nombre inventado a
          partir del lanzamiento, así que una etiqueta renombrada o borrada seguía
          apareciendo igual de bien y nadie se enteraba. */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-white/5 bg-black/30 p-4">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">
            Lista
          </div>
          {listId ? (
            <>
              <div className="mt-1 text-sm text-white">
                {nombreDeLista ?? (
                  <span className="text-red-300">
                    Ya no está en ActiveCampaign
                  </span>
                )}
              </div>
              <div className="mt-1 font-[family-name:var(--font-mono)] text-xs text-zinc-500">
                #{listId}
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-zinc-500">— sin conectar —</div>
          )}
        </div>

        <div className="rounded-lg border border-white/5 bg-black/30 p-4">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">
            Etiquetas
          </div>
          <div className="mt-1 space-y-1 text-xs">
            {Object.keys(tagIds).length === 0 && (
              <div className="text-zinc-500">— sin conectar —</div>
            )}
            {CLAVES.filter((c) => tagIds[c.key]).map((c) => {
              const id = tagIds[c.key]!;
              const nombre = etiquetasExistentes.find(
                (t) => t.id === id,
              )?.nombre;
              return (
                <div
                  key={c.key}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-zinc-500">{c.label}</span>
                  <span
                    className={nombre ? "text-zinc-200" : "text-red-300"}
                    title={`#${id}`}
                  >
                    {nombre ?? (catalogoLeido ? "borrada en AC" : `#${id}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {desaparecidas.length > 0 && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/5 p-4 text-sm text-red-200">
          <strong className="font-semibold">
            Esto ya no existe en ActiveCampaign
          </strong>{" "}
          — {desaparecidas.join(", ")}. Alguien lo ha borrado allí, así que lo
          que pase por aquí no se etiquetará ni entrará en la lista. Elige otra
          abajo y guarda.
        </div>
      )}

      {!catalogoLeido && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          No se ha podido leer tu cuenta de ActiveCampaign ahora mismo, así que
          los desplegables salen vacíos y los nombres no se pueden comprobar. No
          es que falte nada: vuelve a cargar en un rato.
        </div>
      )}

      {/* Paso 1: elegir la lista y las etiquetas, o crearlas.

          Antes esto era un botón que creaba siempre una lista y cuatro etiquetas
          nuevas. Para quien empieza está bien; para quien ya tiene su cuenta
          montada —su lista principal, sus etiquetas de siempre— era duplicarle la
          estructura y partirle los contactos en dos sitios. */}
      <form
        action={linkAction.bind(null, launchId)}
        className="space-y-4 rounded-lg border border-white/10 bg-black/30 p-4"
      >
        <div className="text-xs uppercase tracking-widest text-zinc-400">
          1. Dónde van los contactos
        </div>

        <label className="block">
          <span className="block text-[10px] uppercase tracking-widest text-zinc-500">
            Lista
          </span>
          <select
            name="listId"
            defaultValue={listId ? String(listId) : "nueva"}
            className="field-input mt-1 w-full px-3 py-2 text-sm text-white"
          >
            <option value="nueva">
              ✦ Crear una nueva para este lanzamiento («Lanz: …»)
            </option>
            {listId && !nombreDeLista && catalogoLeido && (
              <option value={String(listId)}>
                #{listId} — ya no está en ActiveCampaign
              </option>
            )}
            {listasExistentes.map((l) => (
              <option key={l.id} value={String(l.id)}>
                {l.nombre}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          {CLAVES.map((c) => (
            <label key={c.key} className="block">
              <span className="block text-[10px] uppercase tracking-widest text-zinc-500">
                {c.label}{" "}
                <span className="normal-case tracking-normal text-zinc-600">
                  · {c.when}
                </span>
              </span>
              <select
                name={`tag_${c.key}`}
                defaultValue={tagIds[c.key] ? String(tagIds[c.key]) : "nueva"}
                className="field-input mt-1 w-full px-3 py-2 text-sm text-white"
              >
                <option value="nueva">
                  ✦ Crear «{launchSlug}-{c.key}»
                </option>
                <option value="">— sin etiqueta —</option>
                {tagIds[c.key] &&
                  catalogoLeido &&
                  !etiquetasExistentes.some((t) => t.id === tagIds[c.key]) && (
                    <option value={String(tagIds[c.key])}>
                      #{tagIds[c.key]} — ya no está en ActiveCampaign
                    </option>
                  )}
                {etiquetasExistentes.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-xs text-zinc-500">
            Lo que dejes en «crear» se crea al guardar; lo que elijas de la
            lista se usa tal cual, sin tocar nada de tu cuenta.
            {listasExistentes.length === 0 &&
              " (Todavía no se han podido leer tus listas: comprueba las credenciales de ActiveCampaign.)"}
          </p>
          <SubmitButton pendingLabel="Conectando…">
            {provisioned
              ? "Guardar la conexión"
              : "Conectar con ActiveCampaign"}
          </SubmitButton>
        </div>
      </form>

      {/* Step 2: Push email templates */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          {hasEmails && emailAssetId ? (
            <button
              type="button"
              onClick={handlePushEmails}
              disabled={pushing}
              className={`rounded-md px-4 py-2 text-xs font-semibold uppercase tracking-widest transition ${
                hasTemplates
                  ? "border border-white/10 text-zinc-300 hover:border-white/30 hover:text-white"
                  : "bg-white text-black hover:bg-zinc-200"
              } disabled:opacity-50`}
            >
              {pushing
                ? "Subiendo plantillas..."
                : hasTemplates
                  ? "Re-subir plantillas de email"
                  : "2. Subir emails como plantillas AC"}
            </button>
          ) : (
            <Button variant="ghost" disabled>
              2. Genera la secuencia de emails antes
            </Button>
          )}
        </div>

        {pushResult && pushResult.ok && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
            {pushResult.created}/{pushResult.total} plantillas subidas correctamente a ActiveCampaign.
          </div>
        )}

        {pushResult && !pushResult.ok && (
          <div className="space-y-2 rounded-lg border border-red-400/30 bg-red-500/5 p-3 text-xs text-red-200">
            <div className="font-semibold">
              {pushResult.created > 0
                ? `${pushResult.created}/${pushResult.total} subidas. Algunas fallaron:`
                : "No se pudieron subir las plantillas:"}
            </div>
            {pushResult.errors.map((e, i) => (
              <div key={i} className="ml-2 border-l border-red-400/20 pl-2">
                {e.index > 0 && (
                  <span className="font-medium">Email #{e.index}{e.subject ? ` "${e.subject}"` : ""}: </span>
                )}
                {e.reason}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 3: Schedule campaigns */}
      <div className="flex flex-wrap items-center gap-3">
        {canSchedule ? (
          <form action={scheduleCampaignsAction.bind(null, launchId)}>
            <SubmitButton
              variant={hasCampaigns ? "outline" : "primary"}
              pendingLabel="Creando campanas…"
            >
              {hasCampaigns
                ? "Re-crear campanas programadas"
                : "3. Crear campanas programadas en AC"}
            </SubmitButton>
          </form>
        ) : (
          <Button variant="ghost" disabled>
            3.{" "}
            {!provisioned
              ? "Provisiona lista primero"
              : !hasTemplates
                ? "Sube plantillas primero"
                : "Genera el calendario primero"}
          </Button>
        )}
      </div>

      {hasCampaigns && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-200">
          Las campanas fueron creadas y programadas en ActiveCampaign segun las
          fechas del calendario. Revisa en tu panel de AC que los horarios y
          contenido sean correctos antes de activarlas.
        </div>
      )}

      {provisioned && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
          Cuando un lead entre con <code>?launch={launchSlug}</code> y deje
          email, se sincronizara automaticamente en AC con la lista y el tag
          correspondiente (<code>{launchSlug}-registro</code> para leads,{" "}
          <code>{launchSlug}-comprador</code> tras checkout Stripe).
        </div>
      )}
    </div>
  );
}
