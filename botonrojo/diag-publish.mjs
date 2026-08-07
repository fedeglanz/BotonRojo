import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const [url, token] = process.argv.slice(2);
const t = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
const c = new Client({ name: "diag", version: "1.0.0" });
await c.connect(t);
const call = async (n, a = {}, timeoutMs = 300000) => {
  const t0 = Date.now();
  const r = await c.callTool({ name: n, arguments: a }, undefined, { timeout: timeoutMs });
  return { ms: Date.now() - t0, isError: Boolean(r.isError), text: r.content?.map((x) => x.text).join("\n") ?? "" };
};

// Una "foto" de ~3 MB en base64, como la que manda Claude Design con una imagen real.
const bytes = Buffer.alloc(3 * 1024 * 1024);
for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7) % 251;
const fotoB64 = bytes.toString("base64");
console.log("tamaño del base64:", (fotoB64.length / 1024 / 1024).toFixed(1), "MB");

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>{{nombre}}</title></head>
<body><main><h1>{{promesa}}</h1><img src="jc.jpg" alt="foto"><form data-br="lead"><input type="email" name="email"><button>Ir</button></form></main></body></html>`;

const r = await call("publicar_pagina", {
  lanzamiento: "ejemplo-semilla",
  pagina: "diagnostico-foto",
  crear: "registro",
  titulo: "Diagnóstico con foto",
  html,
  archivos: [{ nombre: "jc.jpg", contenido: fotoB64, base64: true }],
});
console.log("publicar con foto de 3MB ->", r.ms, "ms | isError:", r.isError);
console.log(r.text.replace(/\s+/g, " ").slice(0, 300));
await c.close();
