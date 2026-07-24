import { LaunchLandingPage, findLaunchBySlugOrNotFound } from "@/components/public/launch-landing";

export const dynamic = "force-dynamic";

export default async function PublicLaunchPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const launch = await findLaunchBySlugOrNotFound(slug);
  return <LaunchLandingPage launch={launch} />;
}
