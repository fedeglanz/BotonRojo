import { headers } from "next/headers";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * El robots.txt, distinto según por qué dominio se pregunte.
 *
 * En el dominio de la plataforma se cierra todo: aquí vive el panel, y las páginas
 * de los clientes servidas por nuestra dirección son la copia, no el original —
 * indexarlas competiría con el dominio del cliente por su propio contenido.
 *
 * En el dominio de un cliente se abre, se cierra lo que no es público y se apunta al
 * sitemap, que es lo que de verdad lee un buscador para saber qué hay.
 */
export async function GET() {
  const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const esPlataforma = env.APP_URL.includes(host) || host === "localhost";

  const cuerpo = esPlataforma
    ? [
        "# Dominio de la plataforma: el original de cada página está en el dominio",
        "# de su cliente, así que aquí no se indexa nada.",
        "User-agent: *",
        "Disallow: /",
        "",
      ].join("\n")
    : [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin",
        "Disallow: /api/",
        "Disallow: /login",
        "",
        `Sitemap: https://${host}/sitemap.xml`,
        "",
      ].join("\n");

  return new Response(cuerpo, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
