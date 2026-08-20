import { notFound } from "next/navigation";
import { GraciasContent } from "@/components/public/gracias-content";
import { resolveGraciasLaunch } from "@/server/checkout";
import { renderLaunchPage } from "@/components/public/launch-page-renderer";
import { resolveLaunchByHostname } from "@/server/domains";
import { resolvePages } from "@/lib/launch-pages";
import type { LaunchType } from "@/lib/launch-types";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  session_id?: string;
  lead?: string;
  launch?: string;
  editar?: string;
}>;

/**
 * `/gracias` en el dominio de un cliente.
 *
 * Aquí llegan dos cosas distintas con la misma dirección:
 *
 * · **La vuelta de Stripe**, con `session_id`. Eso es el acuse de una compra y lo
 *   pinta la pantalla de la plataforma, que sabe leer la sesión y el pedido.
 * · **La página de gracias del lanzamiento**, que en el dominio propio vive
 *   justamente en `/gracias` porque ahí no hay slug delante.
 *
 * Ganaba siempre la primera, porque una ruta estática le gana al comodín en Next.
 * El efecto era desconcertante: publicabas la página desde Claude, se guardaba
 * bien, se veía en la dirección de la plataforma —y en su propio dominio salía la
 * pantalla genérica de "¡Bienvenido!". Parecía que no se hubiera publicado.
 *
 * Ahora manda el lanzamiento cuando tiene su propia página de gracias, y la de
 * compra solo cuando la visita trae la sesión de Stripe, que es lo único que la
 * distingue de verdad.
 */
export default async function CustomDomainGraciasPage(props: {
  params: Promise<{ host: string }>;
  searchParams: SearchParams;
}) {
  const { host } = await props.params;
  const sp = await props.searchParams;

  if (!sp.session_id) {
    const launch = await resolveLaunchByHostname(host);
    if (launch) {
      const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
      const propia = pages.find((page) => page.pageKey === "gracias");
      if (propia) {
        return renderLaunchPage(launch, propia, pages, { editar: sp.editar });
      }
    }
    if (!launch) notFound();
  }

  const launch = await resolveGraciasLaunch({
    launchSlug: sp.launch,
    sessionId: sp.session_id,
  });
  return <GraciasContent isLead={sp.lead === "1"} launch={launch} />;
}
