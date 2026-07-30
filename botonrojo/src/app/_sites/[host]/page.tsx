import { notFound } from "next/navigation";
import { renderLaunchPage } from "@/components/public/launch-page-renderer";
import { resolveLaunchByHostname } from "@/server/domains";
import { resolvePages } from "@/lib/launch-pages";
import type { LaunchType } from "@/lib/launch-types";

export const dynamic = "force-dynamic";

export default async function CustomDomainPage(props: { params: Promise<{ host: string }> }) {
  const { host } = await props.params;
  const launch = await resolveLaunchByHostname(host);
  if (!launch) notFound();
  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
  const entryPage = pages.find((p) => p.isEntry) ?? pages[0];
  return renderLaunchPage(launch, entryPage, pages);
}
