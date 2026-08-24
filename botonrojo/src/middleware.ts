import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Any request whose Host header isn't our own app domain gets rewritten to
 * /sitios/<host>/... , where a normal (Node-runtime) route looks the hostname
 * up in the `domains` table and serves that launch's landing page. Custom
 * domains never redirect — the browser URL bar stays on the client's domain.
 *
 * El destino se llamaba `/_sites`, y con ese nombre no funcionó nunca: Next trata
 * cualquier carpeta que empiece por guion bajo como privada y la deja fuera del
 * enrutado, así que la reescritura apuntaba a una ruta que no existía y todo
 * dominio propio contestaba 404. Se ve solo con un dominio real conectado, que es
 * cuando apareció.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const ownHost = req.nextUrl.hostname.toLowerCase();

  // Nadie llega a `/sitios/...` escribiéndolo: es el destino interno de la
  // reescritura. Pedido desde fuera serviría la página de un cliente colgando de
  // nuestro dominio, con su formulario y su carrito en la dirección equivocada.
  if (req.nextUrl.pathname.startsWith("/sitios")) {
    return new NextResponse(null, { status: 404 });
  }

  const isOwnHost =
    !host ||
    host === ownHost ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    // How the screenshot-service container reaches `pnpm dev` on the host in
    // local development — never a real public hostname, safe to allowlist.
    host === "host.docker.internal" ||
    process.env.APP_URL?.includes(host);

  if (isOwnHost) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/sitios/${host}${req.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // `ads-render` is the internal ad-creative surface, only ever fetched by the
  // screenshot service — it must never be rewritten as a custom domain. It
  // can't live under an `_`-prefixed folder: Next excludes those from routing.
  //
  // `track.js` y `br-runtime.js` son los dos scripts que hacen funcionar las
  // páginas: el que mide y el que da comportamiento a las diseñadas en Claude.
  // Reescritos como si fueran una página del cliente contestaban 404, y en el
  // dominio propio eso dejaba el formulario de registro sin nadie que lo enviara
  // — el navegador lo mandaba por GET y el correo del visitante acababa en la
  // barra de direcciones en vez de en la lista.
  // `robots.txt` y `sitemap.xml` tampoco se reescriben: son rutas nuestras que
  // miran el `Host` por su cuenta para contestar una cosa u otra según el dominio.
  matcher: [
    "/((?!_next/|ads-render|api/|favicon.ico|track.js|br-runtime.js|robots.txt|sitemap.xml).*)",
  ],
};
