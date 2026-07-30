import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Any request whose Host header isn't our own app domain gets rewritten to
 * /_sites/<host>/... , where a normal (Node-runtime) route looks the hostname
 * up in the `domains` table and serves that launch's landing page. Custom
 * domains never redirect — the browser URL bar stays on the client's domain.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const ownHost = req.nextUrl.hostname.toLowerCase();

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
  url.pathname = `/_sites/${host}${req.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // `ads-render` is the internal ad-creative surface, only ever fetched by the
  // screenshot service — it must never be rewritten as a custom domain. It
  // can't live under an `_`-prefixed folder: Next excludes those from routing.
  matcher: ["/((?!_next/|ads-render|api/|favicon.ico|track.js).*)"],
};
