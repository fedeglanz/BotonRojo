import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/page-seo";
import { activeHostnameFor } from "@/server/domains";
import { env } from "@/lib/env";
import { findLaunchBySlugOrNotFound } from "@/components/public/launch-landing";
import { renderLaunchPage } from "@/components/public/launch-page-renderer";
import { resolvePages } from "@/lib/launch-pages";
import type { LaunchType } from "@/lib/launch-types";

export const dynamic = "force-dynamic";

export default async function PublicLaunchPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const launch = await findLaunchBySlugOrNotFound(slug);
  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
  const entryPage = pages.find((p) => p.isEntry) ?? pages[0];
  return renderLaunchPage(launch, entryPage, pages, searchParams);
}

/**
 * El título y la descripción con los que esta página se presenta en Google, en
 * WhatsApp y en la pestaña del navegador.
 *
 * Sin esto heredaba los del layout: "Botón Rojo · Lanzamientos". La página podía
 * estar perfecta y presentarse con el nombre de la herramienta con la que se hizo.
 */
export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const launch = await findLaunchBySlugOrNotFound(slug);
  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
  const page = pages.find((p) => p.isEntry) ?? pages[0];
  if (!page) return {};
  return pageMetadataFor({
    launch,
    page,
    hostname: await activeHostnameFor(launch.id),
    appUrl: env.APP_URL,
  });
}
