import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const [url, token] = process.argv.slice(2);
const t = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
const c = new Client({ name: "diag-url", version: "1.0.0" });
await c.connect(t);
const call = async (n, a = {}) => {
  const t0 = Date.now();
  const r = await c.callTool({ name: n, arguments: a }, undefined, { timeout: 120000 });
  return { ms: Date.now() - t0, isError: Boolean(r.isError), text: r.content?.map((x) => x.text).join("\n") ?? "" };
};

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>{{nombre}}</title>
<link rel="stylesheet" href="estilos.css"></head>
<body><main><h1>{{promesa}}</h1><img src="foto.png" alt="foto" width="300">
<form data-br="lead"><input type="email" name="email" required><button>Entrar</button></form></main></body></html>`;

// La foto por url (una imagen pública real) y el css por contenido, que es lo suyo.
const r = await call("publicar_pagina", {
  lanzamiento: "ejemplo-semilla",
  pagina: "diagnostico-foto",
  html,
  archivos: [
    { nombre: "foto.png", url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Example.jpg/320px-Example.jpg" },
    { nombre: "estilos.css", contenido: "main{max-width:40rem;margin:0 auto;padding:4rem 1.5rem;font-family:system-ui}" },
  ],
});
console.log("publicar con la foto por url ->", r.ms, "ms | isError:", r.isError);
console.log(r.text.replace(/\s+/g, " ").slice(0, 220));

const mala = await call("publicar_pagina", {
  lanzamiento: "ejemplo-semilla",
  pagina: "diagnostico-foto",
  html,
  archivos: [{ nombre: "foto.png", url: "https://este-dominio-no-existe-12345.invalid/x.png" }, { nombre: "estilos.css", contenido: "main{}" }],
});
console.log("url que no responde -> isError:", mala.isError, "|", mala.text.slice(0, 140));
await c.close();
