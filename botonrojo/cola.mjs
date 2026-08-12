import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
const [url, token] = process.argv.slice(2);
const t = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
const c = new Client({ name: "cola", version: "1.0.0" });
await c.connect(t);
const call = async (n, a = {}) => {
  const r = await c.callTool({ name: n, arguments: a }, undefined, { timeout: 120000 });
  return { isError: Boolean(r.isError), text: r.content?.map((x) => x.text).join("\n") ?? "" };
};
const { tools } = await c.listTools();
console.log("herramientas:", tools.length);

const pend = JSON.parse((await call("trabajo_pendiente", { lanzamiento: "cola-claude-demo" })).text);
console.log("\n1. pendiente:", pend.pendiente.map((t) => `${t.que}${t.pagina ? ":" + t.pagina : ""}`).join(", "));

const mal = await call("guardar_identidad", {
  lanzamiento: "cola-claude-demo",
  paleta: { primary: "rojo", accent: "#c8a15a", background: "#0f0f12", foreground: "#f5f2ec" },
  tipografias: { display: "Fraunces", body: "Inter" },
});
console.log("2. color inválido -> isError:", mal.isError, "|", mal.text.slice(0, 90));

const ok = await call("guardar_identidad", {
  lanzamiento: "cola-claude-demo",
  paleta: { primary: "#b4472a", accent: "#c8a15a", background: "#0f0f12", foreground: "#f5f2ec" },
  tipografias: { display: "Fraunces", body: "Inter" },
  estilo: { cardStyle: "editorial", ctaStyle: "pill-arrow", intensity: "expresivo", effects: ["grid", "inventado"] },
  notas: "Terroso y editorial, con textura de papel. Nada de degradados fríos.",
});
console.log("3. guardar identidad:", ok.isError ? "ERROR " + ok.text.slice(0, 150) : "ok");
if (!ok.isError) {
  const r = JSON.parse(ok.text);
  console.log("   estilo ajustado:", JSON.stringify(r.estilo_ajustado?.effects), "| cardStyle:", r.estilo_ajustado?.cardStyle);
}

const pend2 = JSON.parse((await call("trabajo_pendiente", { lanzamiento: "cola-claude-demo" })).text);
console.log("4. tras la identidad queda:", pend2.pendiente.map((t) => t.que + (t.pagina ? ":" + t.pagina : "")).join(", ") || "nada");

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>{{nombre}}</title>
<style>html,body{background:#0f0f12;color:#f5f2ec;font-family:Georgia,serif;margin:0}.w{max-width:42rem;margin:0 auto;padding:5rem 1.5rem}h1{font-size:3rem;margin:0 0 1rem}a.cta{display:inline-block;background:#b4472a;color:#fff;padding:1rem 2rem;border-radius:999px;text-decoration:none}</style>
</head><body><div class="w"><h1>{{promesa}}</h1><p>Precio: <span data-br="precio">—</span></p>
<a class="cta" data-br="comprar" href="#">Quiero entrar</a></div></body></html>`;
const pub = await call("publicar_pagina", { lanzamiento: "cola-claude-demo", pagina: "venta", titulo: "Venta", html });
console.log("5. publicar la página:", pub.isError ? "ERROR " + pub.text.slice(0, 150) : "ok");

const pend3 = JSON.parse((await call("trabajo_pendiente", { lanzamiento: "cola-claude-demo" })).text);
console.log("6. cola final:", pend3.pendiente.length === 0 ? "vacía · " + pend3.aviso : JSON.stringify(pend3.pendiente));
await c.close();
