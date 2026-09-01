import { notFound } from "next/navigation";
import { getPdcCheckoutCredentials } from "@/integrations/pdc-checkout";
import { resolveLaunchByHostname } from "@/server/domains";
import { BrandStyle } from "@/components/public/brand-style";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ host: string }>;
  searchParams: Promise<{ checkout_id?: string }>;
};

export default async function PdcCheckoutCustomDomainPage({ params, searchParams }: Props) {
  const { host } = await params;
  const { checkout_id } = await searchParams;

  if (!checkout_id) notFound();

  const launch = await resolveLaunchByHostname(host);
  if (!launch) notFound();

  const creds = await getPdcCheckoutCredentials(launch.organizationId);
  if (!creds) notFound();

  const siteUrl = creds.siteUrl.replace(/\/$/, "");
  const checkoutRes = await fetch(
    `${siteUrl}/wp-json/stripe/v1/checkout-button?checkout_id=${checkout_id}`,
    { cache: "no-store", headers: { "X-API-Key": creds.apiKey } },
  ).catch(() => null);

  if (!checkoutRes?.ok) notFound();

  const { html, css, js } = (await checkoutRes.json()) as {
    html: string;
    css: string;
    js: string;
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--color-bg, #0a0a0a)" }}>
      <BrandStyle palette={launch.brandPalette} fonts={launch.brandFonts} />

      <header style={{ textAlign: "center", padding: "32px 16px 0" }}>
        {launch.brandLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={launch.brandLogoUrl}
            alt={launch.name}
            style={{ height: 40, maxWidth: 200, display: "inline-block" }}
          />
        )}
      </header>

      <div style={{ maxWidth: 640, margin: "32px auto", padding: "0 16px 64px" }}>
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <div dangerouslySetInnerHTML={{ __html: html }} />
        <script dangerouslySetInnerHTML={{ __html: js }} />
      </div>
    </main>
  );
}
