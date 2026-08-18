import { GraciasContent } from "@/components/public/gracias-content";
import { resolveGraciasLaunch } from "@/server/checkout";

type SearchParams = Promise<{
  session_id?: string;
  lead?: string;
  launch?: string;
}>;

export default async function CustomDomainGraciasPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const launch = await resolveGraciasLaunch({ launchSlug: sp.launch, sessionId: sp.session_id });
  return <GraciasContent isLead={sp.lead === "1"} launch={launch} />;
}
