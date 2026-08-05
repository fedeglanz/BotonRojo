import "server-only";

import { TOOLS, ToolError } from "./tools";
import type { McpAuth } from "./auth";

/**
 * MCP over HTTP, hand-rolled.
 *
 * The official SDK's HTTP transport wants Node's `req`/`res`; a Next route handler
 * gets a Web `Request`. Bridging those is more code than this, and this way the
 * whole protocol surface is visible: five methods, no sessions, no streaming. The
 * SDK is still a devDependency — it's the client used to test this, which is the
 * part where an independent implementation actually pays off.
 *
 * Streamable HTTP allows a plain JSON response when the server has nothing to
 * stream, which is our case: tools return once and we never push notifications.
 */

const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
];
const DEFAULT_PROTOCOL_VERSION = "2025-03-26";

const SERVER_INFO = {
  name: "boton-rojo",
  title: "Botón Rojo · Lanzamientos",
  version: "1.0.0",
};

const INSTRUCTIONS = `Estas herramientas manejan los lanzamientos de una cuenta de Botón Rojo.

Para diseñar y publicar una página:
1. listar_lanzamientos, para saber cuál es y cómo se llaman sus páginas.
2. contexto_lanzamiento, para la marca, la promesa, los precios y las fechas.
3. contrato_pagina, para saber qué atributos tiene que llevar el HTML.
4. Diseña el HTML completo.
5. publicar_pagina.

No hace falta programar el formulario, el pago, la cuenta atrás ni la medición: la
plataforma los cablea al publicar. Si la cuenta no tiene plan pro, publicar diseño
propio no está disponible; usa generar_pagina.`;

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

function result(id: JsonRpcId, value: unknown) {
  return { jsonrpc: "2.0" as const, id, result: value };
}

function error(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return {
    jsonrpc: "2.0" as const,
    id,
    error: { code, message, ...(data ? { data } : {}) },
  };
}

/** Text is the only content type these tools produce; JSON goes as pretty text
 *  because that's what the model reads best. */
function textContent(value: unknown) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }] };
}

async function handleMessage(message: JsonRpcRequest, auth: McpAuth) {
  const id = message.id ?? null;

  switch (message.method) {
    case "initialize": {
      const asked = String(message.params?.protocolVersion ?? "");
      const version = SUPPORTED_PROTOCOL_VERSIONS.includes(asked)
        ? asked
        : DEFAULT_PROTOCOL_VERSION;
      return result(id, {
        protocolVersion: version,
        // Only tools. No resources or prompts: everything here is an action or a
        // lookup, and declaring capabilities we don't serve just invites calls
        // that fail.
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }

    case "ping":
      return result(id, {});

    case "tools/list":
      return result(id, {
        tools: TOOLS.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });

    case "tools/call": {
      const name = String(message.params?.name ?? "");
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return error(id, -32602, `Unknown tool: ${name}`);

      const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const value = await tool.handler(auth, args);
        return result(id, textContent(value));
      } catch (err) {
        // A ToolError is a message for the model — it goes back as a tool result
        // with isError, so Claude can explain it and try something else. Anything
        // else is a bug on our side and goes back as a protocol error.
        if (err instanceof ToolError) {
          return result(id, { ...textContent(err.message), isError: true });
        }
        console.error(`[mcp] ${name} failed`, err);
        const detail = err instanceof Error ? err.message : String(err);
        return result(id, {
          ...textContent(`Error interno: ${detail}`),
          isError: true,
        });
      }
    }

    // Lists we don't serve, answered empty rather than with an error: some clients
    // probe for them on connect and log a failure that looks like a broken server.
    case "resources/list":
      return result(id, { resources: [] });
    case "resources/templates/list":
      return result(id, { resourceTemplates: [] });
    case "prompts/list":
      return result(id, { prompts: [] });

    default:
      return error(id, -32601, `Method not found: ${message.method}`);
  }
}

/**
 * One POST body — a single message or a batch — to its response.
 *
 * Returns null when there is nothing to answer: notifications have no id and must
 * get an empty 202, not a JSON-RPC envelope with a null id.
 */
export async function handleMcpPost(
  payload: unknown,
  auth: McpAuth,
): Promise<unknown | null> {
  const messages = Array.isArray(payload) ? payload : [payload];
  const responses: unknown[] = [];

  for (const raw of messages) {
    if (!raw || typeof raw !== "object") {
      responses.push(error(null, -32600, "Invalid Request"));
      continue;
    }
    const message = raw as JsonRpcRequest;
    if (typeof message.method !== "string") {
      responses.push(error(message.id ?? null, -32600, "Invalid Request"));
      continue;
    }
    // Notifications (no id) are acknowledged by the transport, not answered.
    if (message.id === undefined || message.id === null) continue;

    responses.push(await handleMessage(message, auth));
  }

  if (!responses.length) return null;
  return Array.isArray(payload) ? responses : responses[0];
}
