import type { Metadata } from "next";
import { pageMetadataFor } from "@/lib/page-seo";
import { activeHostnameFor } from "@/server/domains";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";
import { findLaunchBySlugOrNotFound } from "@/components/public/launch-landing";
import { renderLaunchPage } from "@/components/public/launch-page-renderer";
import { resolvePages } from "@/lib/launch-pages";
import type { LaunchType } from "@/lib/launch-types";

export const dynamic = "force-dynamic";

export default async function PublicLaunchSubPage(props: {
  params: Promise<{ slug: string; page: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const { slug, page } = await props.params;
  const searchParams = await props.searchParams;
  const launch = await findLaunchBySlugOrNotFound(slug);
  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
  const pageDef = pages.find((p) => p.pageKey === page);
  if (!pageDef) notFound();
  return renderLaunchPage(launch, pageDef, pages, searchParams);
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string; page: string }>;
}): Promise<Metadata> {
  const { slug, page } = await props.params;
  const launch = await findLaunchBySlugOrNotFound(slug);
  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
  const pageDef = pages.find((p) => p.pageKey === page);
  if (!pageDef) return {};
  return pageMetadataFor({
    launch,
    page: pageDef,
    hostname: await activeHostnameFor(launch.id),
    appUrl: env.APP_URL,
  });
}
