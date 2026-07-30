import { notFound } from "next/navigation";
import { renderLaunchPage } from "@/components/public/launch-page-renderer";
import { resolveLaunchByHostname } from "@/server/domains";
import { resolvePages } from "@/lib/launch-pages";
import type { LaunchType } from "@/lib/launch-types";

export const dynamic = "force-dynamic";

export default async function CustomDomainSubPage(props: { params: Promise<{ host: string; page: string }> }) {
  const { host, page } = await props.params;
  const launch = await resolveLaunchByHostname(host);
  if (!launch) notFound();
  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
  const pageDef = pages.find((p) => p.pageKey === page);
  if (!pageDef) notFound();
  return renderLaunchPage(launch, pageDef, pages);
}
