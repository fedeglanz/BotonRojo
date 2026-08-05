import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const [url, token] = process.argv.slice(2);
const t = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
const c = new Client({ name: "check", version: "1.0.0" });
await c.connect(t);
const call = async (n, a = {}) => {
  const r = await c.callTool({ name: n, arguments: a });
  return { isError: Boolean(r.isError), text: r.content?.map((x) => x.text).join("\n") ?? "" };
};
const { tools } = await c.listTools();
console.log("herramientas:", tools.length, "|", tools.map((x) => x.name).join(", "));

const antes = JSON.parse((await call("contexto_lanzamiento", { lanzamiento: "ejemplo-venta-directa" })).text);
console.log("\npáginas antes:", antes.paginas.map((p) => p.pagina).join(", "));

const creada = await call("crear_pagina", { lanzamiento: "ejemplo-venta-directa", nombre: "Webinar de junio", tipo: "registro" });
console.log("crear_pagina:", creada.isError ? "ERROR " + creada.text.slice(0, 160) : creada.text.replace(/\s+/g, " ").slice(0, 200));

const reservada = await call("crear_pagina", { lanzamiento: "ejemplo-venta-directa", nombre: "admin", tipo: "venta" });
console.log("nombre reservado -> isError:", reservada.isError, "|", reservada.text.slice(0, 90));

const repetida = await call("crear_pagina", { lanzamiento: "ejemplo-venta-directa", nombre: "Webinar de junio", tipo: "registro" });
console.log("repetida -> isError:", repetida.isError, "|", repetida.text.slice(0, 80));

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>{{nombre}}</title></head>
<body style="background:#08080c;color:#fafafa;font-family:system-ui">
<main style="max-width:38rem;margin:0 auto;padding:5rem 1.5rem">
<h1 style="font-size:2.6rem;line-height:1.1">{{promesa}}</h1>
<p>Plazas para el webinar del 12 de junio.</p>
<div data-br="cuenta-atras" data-br-fecha="registro" data-br-fin="Cerrado"></div>
<form data-br="lead">
  <input name="name" placeholder="Nombre" required>
  <input type="email" name="email" placeholder="Email" required>
  <button type="submit">Reservar plaza</button>
  <small data-br="estado"></small>
</form>
<p hidden data-br="lead-ok">Reservada. Te esperamos.</p>
<a href="{{url_venta}}">Ver la oferta</a>
</main></body></html>`;

const pub = await call("publicar_pagina", { lanzamiento: "ejemplo-venta-directa", pagina: "webinar-de-junio", titulo: "Webinar de junio", html });
console.log("publicar:", pub.isError ? "ERROR " + pub.text.slice(0, 200) : pub.text.replace(/\s+/g, " ").slice(0, 170));

const deUnaVez = await call("publicar_pagina", { lanzamiento: "ejemplo-venta-directa", pagina: "Segunda oferta", crear: "venta", html });
console.log("publicar creando a la vez:", deUnaVez.isError ? "ERROR " + deUnaVez.text.slice(0, 200) : deUnaVez.text.replace(/\s+/g, " ").slice(0, 170));

const despues = JSON.parse((await call("contexto_lanzamiento", { lanzamiento: "ejemplo-venta-directa" })).text);
console.log("\npáginas después:", despues.paginas.map((p) => `${p.pagina}(${p.estado})`).join(", "));
await c.close();
