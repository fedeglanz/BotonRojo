import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const [url, token] = process.argv.slice(2);
const t = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
const c = new Client({ name: "emails", version: "1.0.0" });
await c.connect(t);
const call = async (n, a = {}) => {
  const r = await c.callTool({ name: n, arguments: a }, undefined, { timeout: 120000 });
  return { isError: Boolean(r.isError), text: r.content?.map((x) => x.text).join("\n") ?? "" };
};
const L = "clase-de-tecnica-de-natacion";
const { tools } = await c.listTools();
console.log("herramientas:", tools.length, "| campañas:", tools.filter((x) => x.name.includes("email")).map((x) => x.name).join(", "));

const contrato = await call("contrato_email");
console.log("\ncontrato_email:", contrato.text.length, "caracteres");

const antes = JSON.parse((await call("listar_emails", { lanzamiento: L })).text);
console.log("campañas antes:", antes.campanas.length);

const email = (extra = "") => `<!doctype html><html><body style="margin:0;background:#f3f6f8">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f8"><tr><td align="center" style="padding:32px 12px">
<table width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:14px">
<tr><td style="padding:32px;font-family:Georgia,'Times New Roman',serif;color:#0e2233">
<h1 style="margin:0 0 12px;font-size:26px;color:#0b6fa4">{{nombre}}</h1>
<p style="margin:0 0 18px;font-size:16px;line-height:1.6">{{promesa}}</p>
${extra}
<a href="{{url_registro}}" style="display:inline-block;background:#0b6fa4;color:#ffffff;padding:14px 26px;border-radius:999px;text-decoration:none;font-weight:bold">Reservar mi plaza</a>
</td></tr>
<tr><td style="padding:0 32px 28px;font-family:Arial,sans-serif;font-size:12px;color:#6b7a86">
Si no quieres recibir más correos, <a href="{{url_baja}}" style="color:#6b7a86">darte de baja</a>.
</td></tr></table></td></tr></table></body></html>`;

const sinBaja = await call("publicar_email", {
  lanzamiento: L, nombre: "Sin baja", asunto: "Prueba", html: email().replace(/\{\{url_baja\}\}/, "#"),
});
console.log("\n1. sin enlace de baja -> isError:", sinBaja.isError, "|", sinBaja.text.slice(0, 110));

const tokenMalo = await call("publicar_email", {
  lanzamiento: L, nombre: "Token inventado", asunto: "Prueba", html: email("<p>{{descuento_secreto}}</p>"),
});
console.log("2. token inventado -> isError:", tokenMalo.isError, "|", tokenMalo.text.slice(0, 120));

for (const [nombre, asunto] of [["Bienvenida 1", "Ya estás dentro"], ["Bienvenida 2", "El error más común en el agua"], ["Recordatorio", "Mañana cerramos plazas"]]) {
  const r = await call("publicar_email", { lanzamiento: L, nombre, asunto, preencabezado: "Dos minutos de lectura", html: email() });
  console.log(`3. publicar "${nombre}":`, r.isError ? "ERROR " + r.text.slice(0, 120) : "ok");
}

const rep = await call("publicar_email", { lanzamiento: L, nombre: "Bienvenida 1", asunto: "Ya estás dentro (v2)", html: email() });
console.log("4. republicar con el mismo nombre:", rep.isError ? "ERROR" : JSON.parse(rep.text).sustituida === true ? "sustituida ✓" : "duplicada ✗");

const despues = JSON.parse((await call("listar_emails", { lanzamiento: L })).text);
console.log("\n5. campañas ahora:", despues.campanas.map((x) => `${x.nombre} [${x.asunto}]`).join(" | "));
await c.close();
