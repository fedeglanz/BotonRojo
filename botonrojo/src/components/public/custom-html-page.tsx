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
    // Frase hecha, no cifras sueltas: el diseñador no tiene que redactarla ni
    // dividir el total, que casi nunca da un número cobrable.
    plazos:
      launch.installmentCount && launch.installmentPriceCents
        ? `${launch.installmentCount} pagos de ${formatPrice(launch.installmentPriceCents, launch.currency ?? "EUR")}`
        : "",
    cierre_carrito: launch.cartClosesAt?.toISOString() ?? "",
    cierre_registro: launch.registrationClosesAt?.toISOString() ?? "",
    url_registro: registro
      ? pagePath(launch.slug, registro)
      : `/${launch.slug}`,
    url_venta: venta ? pagePath(launch.slug, venta) : `/${launch.slug}`,
    url_gracias: "/gracias",
    url_checkout_campus: (() => {
      const cache = (launch.assetsCache ?? {}) as Record<string, unknown>;
      const urls = (cache.pdcCheckoutUrls ?? []) as Array<{ checkout_url_stripe: string | null }>;
      return urls[0]?.checkout_url_stripe ?? "";
    })(),
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
    installments: tokens.plazos || null,
    cartClosesAt: launch.cartClosesAt?.toISOString() ?? null,
    registrationClosesAt: launch.registrationClosesAt?.toISOString() ?? null,
    leadNext: `/gracias?lead=1&launch=${launch.slug}`,
    pageKey,
  };

  return (
    <>
      <div
        data-br-pagina=""
        className={page.bodyClass || undefined}
        style={page.bodyStyle ? parseStyleAttribute(page.bodyStyle) : undefined}
        // The reset goes first and the design's own CSS right after it, both as raw
        // HTML so React can't hoist them into the head and reorder them. See the
        // note on SplitPage.markup.
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: SHELL_RESET + page.markup }}
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
 * Undoes what the app's shell imposes on every page.
 *
 * A hosted page renders inside the app's layout, and that layout is not neutral:
 * `globals.css` sets a background, a colour and a font on `html, body` with no
 * cascade layer, and the layout paints three decorative divs plus a film grain over
 * everything. All of it was landing on top of designs that had their own ideas —
 * that's the "otro fondo y otro tipo de letra" a published page came out with.
 *
 * Only the app's own decoration carries `!important`: those elements belong to us
 * and nobody else styles them. Everything the design might want to set instead —
 * background, colour, font — is left at plain specificity, so its own rules, which
 * come right after this one, win on document order without a fight.
 */
const SHELL_RESET = `<style>
  .mesh-bg, .circuit-grid, .vignette { display: none !important; }
  body.grain::before { display: none !important; }
  html, body {
    background: #ffffff;
    color: #18181b;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    margin: 0;
    padding: 0;
  }
  /* El envoltorio hace de lienzo: si el diseño puso el fondo en el atributo style
     del <body>, sin esto solo cubriría el alto de su contenido. */
  [data-br-pagina] { min-height: 100svh; }

  /* Y los estilos de elemento de la app, que también son suyos y no del diseño:
     globals.css da a los titulares su tipografía, su peso, su interletraje y un
     tamaño fluido, y a code/pre la monoespaciada. Un h1 que el diseño esperaba
     heredando su serif salía con la tipografía de la plataforma.

     "revert" y no "inherit": devuelve cada propiedad a lo que diría el navegador,
     que es lo que un documento HTML normal hace. Así un h1 sin estilos propios
     sale en negrita y a 2em —lo esperable— en vez de heredar el tamaño del cuerpo.

     Sin !important a propósito: esta regla no lleva capa y la de la app va en
     @layer base, así que esta gana; y el CSS del diseño, que viene después y
     tampoco lleva capa, gana a esta. Cada uno en su sitio.

     Los márgenes y el box-sizing del preflight de Tailwind se quedan: son una base
     neutra que casi cualquier diseño moderno da por hecha, y devolverlos también
     rompería más de lo que arregla. */
  h1, h2, h3, h4, h5, h6 {
    font-family: revert;
    font-size: revert;
    font-weight: revert;
    line-height: revert;
    letter-spacing: revert;
    text-wrap: revert;
  }
  p, li { line-height: revert; text-wrap: revert; }
  code, kbd, samp, pre { font-family: revert; }

  /* Los controles de formulario, enteros. El preflight de Tailwind les quita el
     borde, el relleno y el fondo —cosa razonable cuando cada input lleva sus
     clases—, pero en una página alojada dejaba el campo de email y el botón
     invisibles: un formulario que no parecía un formulario.

     "all: revert" es tosco a propósito: lo que queremos es exactamente lo que el
     navegador pintaría, y cualquier regla del diseño, que va después y sin capa,
     sigue ganando a esto. */
  input, textarea, select, button, fieldset, legend { all: revert; }
</style>`;

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
