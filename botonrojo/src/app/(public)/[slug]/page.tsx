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
