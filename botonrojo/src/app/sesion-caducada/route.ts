import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where a stale session gets sent to be thrown away.
 *
 * The guard used to redirect straight to the login, which showed the right message
 * but left the dead cookie in place: every later navigation hit the guard again and
 * the explanation reappeared as if logging in hadn't worked. A server component
 * can't delete a cookie — only a route handler or middleware can — so the trip goes
 * through here first.
 *
 * Both names are cleared because the cookie is prefixed `__Secure-` only when the
 * app is served over HTTPS: in production one exists and in local development the
 * other, and deleting the wrong one leaves the problem exactly as it was.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const response = NextResponse.redirect(
    new URL("/login?sesion=caducada", url.origin),
  );

  for (const name of [
    "authjs.session-token",
    "__Secure-authjs.session-token",
  ]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
  return response;
}
