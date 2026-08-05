import { NextResponse } from "next/server";

import { authenticate } from "@/mcp/auth";
import { handleMcpPost } from "@/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The same endpoint with the token in the URL.
 *
 * Some connector UIs only accept a URL — no headers — and without this the product
 * simply couldn't be connected from them. It's the worse option and stays second:
 * a URL travels through browser history, proxy logs and screenshares in a way an
 * Authorization header does not. The docs say to prefer the header, and each token
 * can be revoked on its own precisely because this form leaks more easily.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const auth = await authenticate(token);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error" },
      },
      { status: 400 },
    );
  }

  const response = await handleMcpPost(payload, auth);
  if (response === null) return new Response(null, { status: 202 });
  return NextResponse.json(response);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const auth = await authenticate(token);
  if (!auth)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new Response(null, { status: 204 });
}
