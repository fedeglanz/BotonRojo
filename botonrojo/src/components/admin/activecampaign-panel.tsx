import { SubmitButton } from "./submit-button";
import { Button } from "@/components/ui/button";

type Props = {
  launchId: string;
  launchSlug: string;
  configured: boolean;
  listId: number | null;
  tagIds: Record<string, number>;
  hasEmails: boolean;
  emailAssetId: string | null;
  hasTemplates: boolean;
  hasCampaigns: boolean;
  hasMilestones: boolean;
  provisionAction: (launchId: string, formData: FormData) => Promise<void>;
  pushEmailsAction: (launchId: string, assetId: string) => Promise<void>;
  scheduleCampaignsAction: (launchId: string) => Promise<void>;
};

export function ActiveCampaignPanel({
  launchId,
  launchSlug,
  configured,
  listId,
  tagIds,
  hasEmails,
  emailAssetId,
  hasTemplates,
  hasCampaigns,
  hasMilestones,
  provisionAction,
  pushEmailsAction,
  scheduleCampaignsAction,
}: Props) {
  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
        ActiveCampaign no esta configurado. Conectalo desde Ajustes &gt; Integraciones.
      </div>
    );
  }

  const provisioned = Boolean(listId);
  const canSchedule = provisioned && hasTemplates && hasMilestones;

  // Detect if tags have a custom prefix (tag name != launchSlug-suffix)
  const currentTagBase = Object.entries(tagIds).length > 0
    ? Object.entries(tagIds)[0]?.[0] === "registro"
      ? undefined // we can't detect prefix from the stored data, it's just {registro: id}
      : undefined
    : undefined;

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
                <span>{k}</span>
                <span className="text-zinc-500">#{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step 1: Provision list + tags */}
      <form action={provisionAction.bind(null, launchId)} className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-[10px] uppercase tracking-widest text-zinc-500">
              Prefijo de tags (opcional)
            </span>
            <input
              name="tagPrefix"
              type="text"
              placeholder={`ej: prueba, test, v2`}
              className="mt-1 w-48 rounded-lg border border-white/10 bg-black/60 px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-white outline-none focus:border-white/30"
            />
          </label>
          <SubmitButton variant={provisioned ? "outline" : "primary"} pendingLabel="Conectando…">
            {provisioned ? "Re-sincronizar lista y tags" : "1. Crear lista y tags en AC"}
          </SubmitButton>
        </div>
        <p className="text-[10px] text-zinc-600">
          Tags: <span className="text-zinc-500">[prefijo-]{launchSlug}-registro</span>,{" "}
          <span className="text-zinc-500">[prefijo-]{launchSlug}-comprador</span>, etc.
          Si dejas vacio usa solo el slug.
        </p>
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
          automaticamente en AC con la lista y el tag correspondiente.
        </div>
      )}
    </div>
  );
}
