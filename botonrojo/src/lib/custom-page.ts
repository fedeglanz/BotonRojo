import { parse } from "node-html-parser";

/**
 * Hosting a page somebody else designed.
 *
 * A page designed in Claude Design arrives as a finished HTML document. We can't
 * just print it: a launch page has to measure visits, capture leads, start
 * checkouts and keep the affiliate attribution — and none of that is in the
 * design. Two mechanisms bridge that gap, and they're deliberately different:
 *
 * 1. TOKENS, replaced here on the server. `{{precio}}` and friends are values the
 *    designer can't know at design time. Text substitution, nothing else.
 * 2. BEHAVIOUR, wired in the browser by `br-runtime.js` through `data-br`
 *    attributes. Behaviour can't be substituted into text — a form has to be
 *    submitted somewhere, a button has to open Stripe.
 *
 * The split matters because it decides what breaks when the designer forgets
 * something. A missing token shows an obviously wrong page. A missing `data-br`
 * would silently produce a form that captures nothing — so the runtime also
 * recognises an unmarked email form. Better a guess than a black hole.
 */

export type CustomPageAssets = {
  /** Relative path as referenced in the HTML → absolute URL where we host it. */
  [path: string]: string;
};

export type CustomPageBody = {
  format: "html";
  html: string;
  /** Uploaded css/js/images, keyed by the relative path used in the HTML. */
  files?: CustomPageAssets;
  publishedAt?: string;
  /** Who wrote it, for the panel. Always "claude-design" for now. */
  source?: string;
  title?: string;
};

export function isCustomPageBody(body: unknown): body is CustomPageBody {
  return (
    Boolean(body) &&
    typeof body === "object" &&
    (body as { format?: unknown }).format === "html" &&
    typeof (body as { html?: unknown }).html === "string"
  );
}

/* ------------------------------------------------------------------ tokens -- */

export type PageTokens = {
  nombre: string;
  promesa: string;
  precio: string;
  precio_sin_formato: string;
  moneda: string;
  /** "3 pagos de 39,90 €", o vacío si el lanzamiento no tiene plazos. */
  plazos: string;
  cierre_carrito: string;
  cierre_registro: string;
  url_registro: string;
  url_venta: string;
  url_gracias: string;
  slug: string;
};

/** `{{ precio }}` and `{{precio}}` are the same token; anything unknown is left
 *  alone, because a stray `{{...}}` in the copy is not ours to eat. */
export function replaceTokens(
  html: string,
  tokens: Partial<PageTokens>,
): string {
  return html.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (whole, name: string) => {
    const value = tokens[name.toLowerCase() as keyof PageTokens];
    return value === undefined ? whole : value;
  });
}

/* ------------------------------------------------------------------- parse -- */

export type SplitPage = {
  /**
   * Everything inside <body>, with the document's own stylesheets moved to the
   * front and its scripts taken out.
   *
   * The CSS stays INSIDE the markup on purpose. React hoists any `<style>` or
   * `<link>` it renders into the `<head>`, where it lands next to the app's own
   * stylesheet at the same specificity — and then which one wins depends on
   * insertion order, which isn't ours to decide. That's the bug where a published
   * page came out with the app's background and font instead of its own.
   *
   * Injected as raw HTML it isn't hoisted: it sits after the app's stylesheet in
   * document order, so the design wins every time, and without a single
   * `!important`.
   */
  markup: string;
  /** class attribute of <body>, so a design that styles the body still works. */
  bodyClass: string;
  bodyStyle: string;
  /** <script> blocks, in document order. Kept apart because markup injected with
   *  dangerouslySetInnerHTML never executes its scripts — they have to be
   *  re-emitted as real elements. */
  scripts: Array<
    | { kind: "inline"; code: string }
    | { kind: "src"; src: string; module: boolean }
  >;
  title: string | null;
};

/**
 * Splits a document into the pieces React can render.
 *
 * A real parser rather than regexes: the input is a whole designed page, with
 * inline SVG, template literals inside scripts and CSS containing `</`. Every
 * regex version of this eventually eats half a page.
 */
export function splitDocument(html: string): SplitPage {
  const root = parse(html, {
    // Keep what a design needs; comments are dropped since they only add weight.
    comment: false,
    blockTextElements: { script: true, noscript: true, style: true, pre: true },
  });

  const scripts: SplitPage["scripts"] = [];

  // The design's stylesheets, in document order, as raw HTML. Taken out of wherever
  // they were (usually the head, which isn't rendered) so they can be put back at
  // the top of the body — see the note on `markup`.
  const styleHtml: string[] = [];
  for (const el of root.querySelectorAll('style, link[rel="stylesheet"]')) {
    styleHtml.push(el.toString());
    el.remove();
  }

  for (const el of root.querySelectorAll("script")) {
    const src = el.getAttribute("src");
    const module = el.getAttribute("type") === "module";
    if (src) scripts.push({ kind: "src", src, module });
    else if (el.innerHTML.trim())
      scripts.push({ kind: "inline", code: el.innerHTML });
    el.remove();
  }

  const body = root.querySelector("body");
  const titleEl = root.querySelector("title");

  return {
    markup: styleHtml.join("\n") + (body ?? root).innerHTML,
    bodyClass: body?.getAttribute("class") ?? "",
    bodyStyle: body?.getAttribute("style") ?? "",
    scripts,
    title: titleEl?.text?.trim() || null,
  };
}

/* ------------------------------------------------------------------- files -- */

/**
 * Points relative references at where we host the uploaded files.
 *
 * The designer writes `href="estilos.css"` and `src="fondo.webp"`; those files
 * arrive alongside the HTML and end up in object storage under a URL that has
 * nothing to do with the original path. Rewriting here — rather than asking the
 * designer to know the final URLs — is what makes "publish the page as it is"
 * true.
 */
export function rewriteAssetPaths(
  html: string,
  files: CustomPageAssets,
): string {
  if (!Object.keys(files).length) return html;

  return html.replace(
    /(\s(?:src|href|poster)\s*=\s*)(["'])([^"']+)\2/gi,
    (whole, prefix: string, quote: string, value: string) => {
      const key = value.replace(/^\.\//, "");
      const url = files[key] ?? files[value];
      return url ? `${prefix}${quote}${url}${quote}` : whole;
    },
  );
}

/**
 * Relative references the HTML makes that no uploaded file answers.
 *
 * Reported back to the caller as an error instead of publishing a page with
 * broken images: a 404 on a background image is the kind of thing nobody notices
 * until the client does.
 */
export function unresolvedReferences(
  html: string,
  files: CustomPageAssets,
): string[] {
  const out = new Set<string>();
  const re = /\s(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(html))) {
    const value = m[1]!;
    // Absolute, protocol-relative, data URIs, anchors and mailto are not ours.
    if (/^(?:[a-z]+:|\/\/|\/|#|mailto:|tel:)/i.test(value)) continue;
    // A token isn't a file: `href="{{url_venta}}"` becomes a real path when the
    // page is served, and demanding it be uploaded made publishing impossible for
    // any design that linked to another page of the launch.
    if (value.includes("{{")) continue;
    const key = value.replace(/^\.\//, "");
    if (!files[key] && !files[value]) out.add(value);
  }
  return [...out];
}
