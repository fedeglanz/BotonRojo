import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/page-seo";
import { env } from "@/lib/env";
import { notFound, redirect } from "next/navigation";
import { renderLaunchPage } from "@/components/public/launch-page-renderer";
import { resolveLaunchByHostname } from "@/server/domains";
import { resolvePages } from "@/lib/launch-pages";
import type { LaunchType } from "@/lib/launch-types";

export const dynamic = "force-dynamic";

/**
 * Cualquier página del lanzamiento en el dominio del cliente.
 *
 * En el dominio propio la dirección no lleva el slug: la de entrada es la raíz y
 * las demás cuelgan de ella (`/legal-privacidad`, `/baja`). Pero los enlaces que
 * ya existen dentro de las páginas —el pie legal, la baja de la newsletter, la
 * siguiente página de contenido, los tokens de las páginas diseñadas en Claude—
 * están escritos con el slug delante, que es como se llega desde la plataforma.
 *
 * Así que un `/slug/pagina` en este dominio no es un error del visitante: es un
 * enlace nuestro. Se redirige a la dirección limpia en vez de servir la misma
 * página en dos direcciones distintas, que es lo que un buscador castiga.
 */
export default async function CustomDomainPath(props: {
  params: Promise<{ host: string; path: string[] }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { host, path } = await props.params;
  const searchParams = await props.searchParams;
  const launch = await resolveLaunchByHostname(host);
  if (!launch) notFound();

  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
  const entry = pages.find((p) => p.isEntry) ?? pages[0];
  if (!entry) notFound();

  if (path[0] === launch.slug) {
    const resto = path.slice(1);
    const destino =
      resto.length === 0 || resto[0] === entry.pageKey
        ? "/"
        : `/${resto.join("/")}`;
    redirect(destino);
  }

  // Ninguna página del lanzamiento tiene la dirección con dos tramos; si llega
  // así, o es el slug de otro lanzamiento o es una dirección inventada.
  if (path.length !== 1) notFound();

  const pageDef = pages.find((p) => p.pageKey === path[0]);
  if (!pageDef) notFound();
  // La de entrada vive en la raíz y solo ahí.
  if (pageDef.pageKey === entry.pageKey) redirect("/");

  return renderLaunchPage(launch, pageDef, pages, searchParams);
}

export async function generateMetadata(props: {
  params: Promise<{ host: string; path: string[] }>;
}): Promise<Metadata> {
  const { host, path } = await props.params;
  const launch = await resolveLaunchByHostname(host);
  if (!launch || path.length !== 1) return {};
  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
  const page = pages.find((p) => p.pageKey === path[0]);
  if (!page) return {};
  return pageMetadataFor({ launch, page, hostname: host, appUrl: env.APP_URL });
}
