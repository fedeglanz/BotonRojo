import { NextRequest, NextResponse } from "next/server";
import { isDomainActiveForTls } from "@/server/domains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Caddy's `on_demand_tls` hits this before issuing a certificate for a
 * hostname it doesn't have a static site block for. 200 = allowed, anything
 * else = refused. Only reachable from inside the docker network (the app
 * container isn't published publicly — Caddy is the only public entrypoint).
 */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain")?.toLowerCase() ?? "";
  if (!domain) return NextResponse.json({ ok: false }, { status: 400 });

  const allowed = await isDomainActiveForTls(domain);
  return allowed
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false }, { status: 403 });
}
