import Script from "next/script";

import { env } from "@/lib/env";
import {
  replaceTokens,
  rewriteAssetPaths,
  splitDocument,
  type CustomPageBody,
  type PageTokens,
} from "@/lib/custom-page";
import { pagePath, resolvePages } from "@/lib/launch-pages";
import type { LaunchType } from "@/lib/launch-types";
import type { Launch } from "@/db/schema/launches";
import type { Product } from "@/db/schema/products";

/**
 * Renders a page designed outside the app.
 *
 * The design is served as it was made — its own CSS, its own markup — with three
 * things added: the tracking pixel, the runtime that gives its forms and buttons
 * behaviour, and the launch's real values in place of the `{{tokens}}`.
 *
 * The document is taken apart rather than dropped in whole because markup injected
 * with `dangerouslySetInnerHTML` never runs its scripts: a designed page with any
 * interactivity would look right and do nothing. Styles and scripts are re-emitted
 * as real elements, in document order.
 */
export function CustomHtmlPage({
  launch,
  body,
  pageKey,
  products,
}: {
  launch: Launch;
  body: CustomPageBody;
  pageKey: string;
  products: Product[];
}) {
  const product = products[0];
  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
  const registro = pages.find((p) => p.kind === "registro");
  const venta = pages.find((p) => p.kind === "venta");

  const formatPrice = (cents: number, currency: string) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);

  const tokens: Partial<PageTokens> = {
    nombre: launch.name,
    promesa: launch.promise ?? "",
    slug: launch.slug,
    precio: product ? formatPrice(product.priceCents, product.currency) : "",
    precio_sin_formato: product ? String(product.priceCents / 100) : "",
    moneda: product?.currency?.toUpperCase() ?? "EUR",
    cierre_carrito: launch.cartClosesAt?.toISOString() ?? "",
    cierre_registro: launch.registrationClosesAt?.toISOString() ?? "",
    url_registro: registro
      ? pagePath(launch.slug, registro)
      : `/${launch.slug}`,
    url_venta: venta ? pagePath(launch.slug, venta) : `/${launch.slug}`,
    url_gracias: "/gracias",
  };

  // Order matters: paths first, then tokens. A token could otherwise expand into
  // something that looks like a relative path and get rewritten by accident.
  const withPaths = rewriteAssetPaths(body.html, body.files ?? {});
  const resolved = replaceTokens(withPaths, tokens);
  const page = splitDocument(resolved);

  const config = {
    slug: launch.slug,
    launchId: launch.id,
    productSlug: product?.slug ?? null,
    price: tokens.precio || null,
    cartClosesAt: launch.cartClosesAt?.toISOString() ?? null,
    registrationClosesAt: launch.registrationClosesAt?.toISOString() ?? null,
    leadNext: `/gracias?lead=1&launch=${launch.slug}`,
    pageKey,
  };

  return (
    <>
      {page.styles.map((style, i) =>
        style.kind === "inline" ? (
          // eslint-disable-next-line react/no-danger
          <style key={i} dangerouslySetInnerHTML={{ __html: style.css }} />
        ) : (
          <link key={i} rel="stylesheet" href={style.href} />
        ),
      )}

      <div
        className={page.bodyClass || undefined}
        style={page.bodyStyle ? parseStyleAttribute(page.bodyStyle) : undefined}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: page.markup }}
      />

      {/* The design's own scripts, put back as elements so they execute. */}
      {page.scripts.map((s, i) =>
        s.kind === "src" ? (
          <Script
            key={i}
            src={s.src}
            type={s.module ? "module" : undefined}
            strategy="afterInteractive"
          />
        ) : (
          // eslint-disable-next-line react/no-danger
          <script key={i} dangerouslySetInnerHTML={{ __html: s.code }} />
        ),
      )}

      {/* Ours last: the runtime wires elements the design already rendered. */}
      <Script
        src="/track.js"
        data-launch={launch.slug}
        data-api={env.APP_URL}
        strategy="afterInteractive"
      />
      <Script
        src="/br-runtime.js"
        data-launch={launch.slug}
        data-config={JSON.stringify(config)}
        strategy="afterInteractive"
      />
    </>
  );
}

/**
 * `style="a:b;c:d"` as a React style object.
 *
 * React refuses a string there, and the body's own inline style is often where a
 * design puts its background — dropping it would leave the page on a white sheet.
 */
function parseStyleAttribute(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of value.split(";")) {
    const at = part.indexOf(":");
    if (at < 0) continue;
    const prop = part.slice(0, at).trim();
    const val = part.slice(at + 1).trim();
    if (!prop || !val) continue;
    // Custom properties keep their name; the rest become camelCase.
    const key = prop.startsWith("--")
      ? prop
      : prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[key] = val;
  }
  return out;
}
