import { ClaudeGoButton } from "./claude-go-button";
import { SubmitButton } from "./submit-button";

type Campaign = {
  id: string;
  name: string;
  subject: string;
  preheader: string | null;
  publishedAt: string | null;
  acTemplateId: string | null;
};

/**
 * Las campañas diseñadas en Claude Design de un lanzamiento.
 *
 * Cada una es su propio asset, no un elemento de una secuencia: por eso se pueden
 * tener todas las que hagan falta y rediseñar una no toca a las demás. Se identifican
 * por su nombre, y publicar con un nombre repetido sustituye — que es lo que se quiere
 * al corregir una, no acumular versiones.
 *
 * La previsualización abre el HTML crudo en otra pestaña en vez de pintarlo aquí: un
 * email es un documento con sus tablas y su propio `<html>`, y meterlo en el panel lo
 * enseñaría con nuestros estilos por encima, que es justo lo que no se quiere ver.
 */
export function DesignedCampaigns({
  campaigns,
  launchSlug,
  hasConnector,
  acConfigured,
  claudeUrl,
  claudePrompt,
  pushAction,
}: {
  campaigns: Campaign[];
  launchSlug: string;
  hasConnector: boolean;
  acConfigured: boolean;
  claudeUrl: string;
  claudePrompt: string;
  /** Ya viene con el lanzamiento atado: aquí solo falta decir cuál campaña. */
  pushAction: (assetId: string) => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-zinc-400">
          {campaigns.length === 0
            ? "Todavía no hay campañas diseñadas. Claude las hace con la identidad visual del lanzamiento y las guarda aquí; puedes tener todas las que quieras."
            : `${campaigns.length} campaña${campaigns.length === 1 ? "" : "s"} diseñada${campaigns.length === 1 ? "" : "s"} en Claude. Para cambiar una, pídesela otra vez con el mismo nombre y la sustituye.`}
        </p>
        <ClaudeGoButton
          hasConnector={hasConnector}
          label={
            campaigns.length === 0
              ? "Diseñar campañas en Claude"
              : "Diseñar otra"
          }
          href={claudeUrl}
          prompt={claudePrompt}
        />
      </div>

      {campaigns.length > 0 && (
        <ul className="space-y-2">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${campaign.acTemplateId ? "bg-emerald-400" : "bg-zinc-600"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-white">{campaign.name}</div>
                <div className="truncate text-[11px] text-zinc-500">
                  {campaign.subject}
                  {campaign.preheader && ` · ${campaign.preheader}`}
                </div>
              </div>

              {campaign.acTemplateId ? (
                <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-300">
                  En ActiveCampaign
                </span>
              ) : (
                acConfigured && (
                  <form action={pushAction.bind(null, campaign.id)}>
                    <SubmitButton variant="ghost" pendingLabel="Subiendo…">
                      Subir a AC
                    </SubmitButton>
                  </form>
                )
              )}

              <a
                href={`/admin/lanzamientos/${launchSlug}/campanas/${campaign.id}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-md border border-white/15 px-2.5 py-1 text-[11px] uppercase tracking-widest text-zinc-300 transition hover:border-white/40"
              >
                Ver ↗
              </a>
            </li>
          ))}
        </ul>
      )}

      {!acConfigured && campaigns.length > 0 && (
        <p className="text-xs text-amber-300">
          Para subirlas hay que conectar ActiveCampaign antes (paso de
          Conexiones).
        </p>
      )}
    </div>
  );
}
