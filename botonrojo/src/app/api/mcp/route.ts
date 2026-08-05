import { NextResponse } from "next/server";

import { authenticate, tokenFromRequest } from "@/mcp/auth";
import { handleMcpPost } from "@/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The MCP endpoint. One organization per token.
 *
 * `WWW-Authenticate` on a 401 is what makes a client say "this needs a token"
 * instead of "this server is broken".
 */
function unauthorized() {
  return NextResponse.json(
    {
      error: "unauthorized",
      detail:
        "Falta un token de conexión válido (Authorization: Bearer br_mcp_…).",
    },
    {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="boton-rojo"' },
    },
  );
}

export async function POST(req: Request) {
  const auth = await authenticate(tokenFromRequest(req));
  if (!auth) return unauthorized();

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
  // A batch of nothing but notifications: accepted, no body.
  if (response === null) return new Response(null, { status: 202 });

  return NextResponse.json(response);
}

/**
 * GET is where a client would open a stream for server-initiated messages. We
 * never send any, so it's declined — explicitly, so the client stops asking rather
 * than retrying a connection it thinks failed.
 */
export async function GET(req: Request) {
  const auth = await authenticate(tokenFromRequest(req));
  if (!auth) return unauthorized();
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}

/** Session teardown. There are no sessions here, so there is nothing to tear down. */
export async function DELETE() {
  return new Response(null, { status: 204 });
}
