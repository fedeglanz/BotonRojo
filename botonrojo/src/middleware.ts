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
    process.env.APP_URL?.includes(host);

  if (isOwnHost) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/_sites/${host}${req.nextUrl.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico|track.js).*)"],
};
