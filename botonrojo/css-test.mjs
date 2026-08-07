import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const [url, token] = process.argv.slice(2);
const t = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
const c = new Client({ name: "css", version: "1.0.0" });
await c.connect(t);
// Un diseño con opiniones fuertes: fondo crema, tipografía serif, todo en el CSS.
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>{{nombre}}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap">
<style>
  html, body { background: #f4efe6; color: #1b1b18; font-family: "Playfair Display", Georgia, serif; }
  .caja { max-width: 44rem; margin: 0 auto; padding: 6rem 1.5rem; }
  h1 { font-size: 3rem; line-height: 1.05; margin: 0 0 1rem; }
</style></head>
<body class="pagina-crema">
<div class="caja"><h1 id="titular">{{promesa}}</h1>
<p>Fondo crema y tipografía serif, decididos por el diseño.</p>
<form data-br="lead"><input type="email" name="email" required><button>Entrar</button></form></div>
</body></html>`;
const r = await c.callTool({ name: "publicar_pagina", arguments: {
  lanzamiento: "ejemplo-semilla", pagina: "prueba-css", crear: "registro", titulo: "Prueba de CSS", html,
} }, undefined, { timeout: 120000 });
console.log("publicada:", r.content?.map((x) => x.text).join(" ").replace(/\s+/g, " ").slice(0, 120));
await c.close();
