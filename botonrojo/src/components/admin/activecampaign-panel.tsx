import { SubmitButton } from "./submit-button";
import { Button } from "@/components/ui/button";

type Opcion = { id: number; nombre: string };

/** Los cuatro momentos que el lanzamiento etiqueta. */
const CLAVES = [
  { key: "registro", etiqueta: "Registro", para: "quien deja su email" },
  { key: "comprador", etiqueta: "Comprador", para: "quien compra" },
  { key: "evento", etiqueta: "Evento", para: "quien asiste al directo" },
  { key: "abandono", etiqueta: "Carrito abandonado", para: "quien no terminó" },
] as const;

type Props = {
  launchId: string;
  launchSlug: string;
  configured: boolean;
  listId: number | null;
  tagIds: Record<string, number>;
  /** Lo que ya existe en la cuenta de ActiveCampaign, para elegir. */
  listasExistentes: Opcion[];
  etiquetasExistentes: Opcion[];
  linkAction: (launchId: string, formData: FormData) => Promise<void>;
  hasEmails: boolean;
  emailAssetId: string | null;
  hasTemplates: boolean;
  hasCampaigns: boolean;
  hasMilestones: boolean;
  pushEmailsAction: (launchId: string, assetId: string) => Promise<void>;
  scheduleCampaignsAction: (launchId: string) => Promise<void>;
};

export function ActiveCampaignPanel({
  launchId,
  launchSlug,
  configured,
  listId,
  tagIds,
  listasExistentes,
  etiquetasExistentes,
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
        ActiveCampaign no esta configurado. Agrega <code>ACTIVECAMPAIGN_API_URL</code> y{" "}
        <code>ACTIVECAMPAIGN_API_KEY</code> en <code>.env</code> y reinicia la app.
      </div>
    );
  }

  const provisioned = Boolean(listId);
  const canSchedule = provisioned && hasTemplates && hasMilestones;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-white/5 bg-black/30 p-4">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Lista</div>
          <div className="mt-1 font-[family-name:var(--font-mono)] text-sm text-white">
            {listId ?? <span className="text-zinc-500">— sin provisionar —</span>}
          </div>
          <div className="mt-1 text-xs text-zinc-500">{`Lanz: <${launchSlug}>`}</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/30 p-4">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">Tags</div>
          <div className="mt-1 space-y-1 text-xs font-[family-name:var(--font-mono)]">
            {Object.keys(tagIds).length === 0 && <div className="text-zinc-500">— sin provisionar —</div>}
            {Object.entries(tagIds).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-zinc-300">
                <span>{launchSlug}-{k}</span>
                <span className="text-zinc-500">#{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

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
                {c.etiqueta}{" "}
                <span className="normal-case tracking-normal text-zinc-600">
                  · {c.para}
                </span>
              </span>
              <select
                name={`tag_${c.key}`}
                defaultValue={
                  tagIds[c.key] ? String(tagIds[c.key]) : "nueva"
                }
                className="field-input mt-1 w-full px-3 py-2 text-sm text-white"
              >
                <option value="nueva">
                  ✦ Crear «{launchSlug}-{c.key}»
                </option>
                <option value="">— sin etiqueta —</option>
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
            Lo que dejes en «crear» se crea al guardar; lo que elijas de la lista se
            usa tal cual, sin tocar nada de tu cuenta.
            {listasExistentes.length === 0 &&
              " (Todavía no se han podido leer tus listas: comprueba las credenciales de ActiveCampaign.)"}
          </p>
          <SubmitButton pendingLabel="Conectando…">
            {provisioned ? "Guardar la conexión" : "Conectar con ActiveCampaign"}
          </SubmitButton>
        </div>
      </form>

      {/* Step 2: Push email templates */}
      <div className="flex flex-wrap items-center gap-3">
        {hasEmails && emailAssetId ? (
          <form action={pushEmailsAction.bind(null, launchId, emailAssetId)}>
            <SubmitButton variant={hasTemplates ? "outline" : "primary"} pendingLabel="Subiendo plantillas…">
              {hasTemplates ? "Re-subir plantillas de email" : "2. Subir emails como plantillas AC"}
            </SubmitButton>
          </form>
        ) : (
          <Button variant="ghost" disabled>
            2. Genera la secuencia de emails antes
          </Button>
        )}
      </div>

      {/* Step 3: Schedule campaigns */}
      <div className="flex flex-wrap items-center gap-3">
        {canSchedule ? (
          <form action={scheduleCampaignsAction.bind(null, launchId)}>
            <SubmitButton variant={hasCampaigns ? "outline" : "primary"} pendingLabel="Creando campanas…">
              {hasCampaigns ? "Re-crear campanas programadas" : "3. Crear campanas programadas en AC"}
            </SubmitButton>
          </form>
        ) : (
          <Button variant="ghost" disabled>
            3. {!provisioned ? "Provisiona lista primero" : !hasTemplates ? "Sube plantillas primero" : "Genera el calendario primero"}
          </Button>
        )}
      </div>

      {hasCampaigns && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-200">
          Las campanas fueron creadas y programadas en ActiveCampaign segun las fechas del calendario.
          Revisa en tu panel de AC que los horarios y contenido sean correctos antes de activarlas.
        </div>
      )}

      {provisioned && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
          Cuando un lead entre con <code>?launch={launchSlug}</code> y deje email, se sincronizara
          automaticamente en AC con la lista y el tag correspondiente (<code>{launchSlug}-registro</code>{" "}
          para leads, <code>{launchSlug}-comprador</code> tras checkout Stripe).
        </div>
      )}
    </div>
  );
}
