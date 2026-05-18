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
  provisionAction: (launchId: string) => Promise<void>;
  pushEmailsAction: (launchId: string, assetId: string) => Promise<void>;
};

export function ActiveCampaignPanel({
  launchId,
  launchSlug,
  configured,
  listId,
  tagIds,
  hasEmails,
  emailAssetId,
  provisionAction,
  pushEmailsAction,
}: Props) {
  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
        ActiveCampaign no está configurado. Añade <code>ACTIVECAMPAIGN_API_URL</code> y{" "}
        <code>ACTIVECAMPAIGN_API_KEY</code> en <code>.env</code> y reinicia la app.
      </div>
    );
  }

  const provisioned = Boolean(listId);

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

      <div className="flex flex-wrap items-center gap-3">
        <form action={provisionAction.bind(null, launchId)}>
          <SubmitButton variant={provisioned ? "outline" : "primary"} pendingLabel="Conectando…">
            {provisioned ? "Re-sincronizar lista y tags" : "Crear lista y tags en AC"}
          </SubmitButton>
        </form>

        {hasEmails && emailAssetId && (
          <form action={pushEmailsAction.bind(null, launchId, emailAssetId)}>
            <SubmitButton variant="outline" pendingLabel="Subiendo plantillas…">
              Subir emails como plantillas AC
            </SubmitButton>
          </form>
        )}

        {!hasEmails && (
          <Button variant="ghost" disabled>
            Genera la secuencia de emails antes
          </Button>
        )}
      </div>

      {provisioned && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-200">
          Cuando un lead entre con <code>?launch={launchSlug}</code> y deje email, se sincronizará
          automáticamente en AC con la lista y el tag correspondiente (<code>{launchSlug}-registro</code>{" "}
          para leads, <code>{launchSlug}-comprador</code> tras checkout Stripe).
        </div>
      )}
    </div>
  );
}
