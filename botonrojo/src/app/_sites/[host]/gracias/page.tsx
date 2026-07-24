import { GraciasContent } from "@/components/public/gracias-content";

type SearchParams = Promise<{
  session_id?: string;
  lead?: string;
  launch?: string;
}>;

export default async function CustomDomainGraciasPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  return <GraciasContent isLead={sp.lead === "1"} launchSlug={sp.launch} />;
}
