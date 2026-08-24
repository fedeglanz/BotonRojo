import { headers } from "next/headers";

import { resolveLaunchByHostname } from "@/server/domains";
import { resolvePages } from "@/lib/launch-pages";
import { shouldIndex } from "@/lib/page-seo";
import type { LaunchType } from "@/lib/launch-types";

export const dynamic = "force-dynamic";

/**
 * El sitemap del dominio de un cliente, con sus páginas indexables.
 *
 * Solo entran las que se indexan: un sitemap que anuncia una página con `noindex` le
 * está dando a Google dos instrucciones contrarias, y quien decide entonces es él.
 * Las de gracias y de baja quedan fuera solas por eso mismo.
 *
 * En el dominio de la plataforma no hay sitemap: su robots.txt cierra todo, y
 * publicar aquí la lista de páginas de los clientes sería competir con ellos por su
 * propio contenido.
 */
export async function GET() {
  const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const launch = await resolveLaunchByHostname(host);

  if (!launch) {
    return new Response("", { status: 404 });
  }

  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
  const entry = pages.find((p) => p.isEntry) ?? pages[0];
  const actualizado = (launch.updatedAt ?? launch.createdAt).toISOString();

  const urls = pages
    .filter((page) => shouldIndex(launch, page))
    .map((page) => {
      const loc =
        page.pageKey === entry?.pageKey
          ? `https://${host}/`
          : `https://${host}/${page.pageKey}`;
      // La de entrada es la que se quiere posicionar; las demás son apoyo.
      const prioridad = page.pageKey === entry?.pageKey ? "1.0" : "0.6";
      return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${actualizado}</lastmod>\n    <priority>${prioridad}</priority>\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
