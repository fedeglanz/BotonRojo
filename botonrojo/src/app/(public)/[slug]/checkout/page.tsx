import { notFound } from "next/navigation";
import { db } from "@/db";
import { launches } from "@/db/schema/launches";
import { eq } from "drizzle-orm";
import { getPdcCheckoutCredentials } from "@/integrations/pdc-checkout";
import { BrandStyle } from "@/components/public/brand-style";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkout_id?: string }>;
};

export default async function PdcCheckoutPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { checkout_id } = await searchParams;

  if (!checkout_id) notFound();

  const [launch] = await db
    .select()
    .from(launches)
    .where(eq(launches.slug, slug))
    .limit(1);

  if (!launch) return <pre>❌ launch not found: {slug}</pre>;

  const creds = await getPdcCheckoutCredentials(launch.organizationId);
  if (!creds) return <pre>❌ no PDC credentials for org: {launch.organizationId}</pre>;

  const siteUrl = creds.siteUrl.replace(/\/$/, "");
  const campusUrl = `${siteUrl}/wp-json/stripe/v1/checkout-button?checkout_id=${checkout_id}`;
  const checkoutRes = await fetch(campusUrl, {
    cache: "no-store",
    headers: { "X-API-Key": creds.apiKey },
  }).catch(() => null);

  if (!checkoutRes?.ok) {
    return <pre>❌ campus fetch failed: {campusUrl} → {checkoutRes?.status ?? "network error"}</pre>;
  }

  const { html, css, js } = (await checkoutRes.json()) as {
    html: string;
    css: string;
    js: string;
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--color-bg, #0a0a0a)" }}>
      <BrandStyle palette={launch.brandPalette} fonts={launch.brandFonts} />

      {/* Header con logo del lanzamiento */}
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

      {/* Checkout embebido del campus */}
      <div
        style={{ maxWidth: 640, margin: "32px auto", padding: "0 16px 64px" }}
      >
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <div dangerouslySetInnerHTML={{ __html: html }} />
        <script dangerouslySetInnerHTML={{ __html: js }} />
      </div>
    </main>
  );
}
