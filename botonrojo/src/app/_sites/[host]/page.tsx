import { notFound } from "next/navigation";
import { LaunchLandingPage } from "@/components/public/launch-landing";
import { resolveLaunchByHostname } from "@/server/domains";

export const dynamic = "force-dynamic";

export default async function CustomDomainPage(props: { params: Promise<{ host: string }> }) {
  const { host } = await props.params;
  const launch = await resolveLaunchByHostname(host);
  if (!launch) notFound();
  return <LaunchLandingPage launch={launch} />;
}
