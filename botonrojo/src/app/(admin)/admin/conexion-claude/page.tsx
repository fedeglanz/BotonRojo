import { eq } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { listTokens, canPublishCustomPages } from "@/mcp/auth";
import {
  createMcpTokenAction,
  revokeMcpTokenAction,
} from "@/server/mcp-tokens";
import { McpTokensPanel } from "@/components/admin/mcp-tokens-panel";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function ConexionClaudePage() {
  const { organizationId } = await requireOrgAdmin();
  if (!organizationId) throw new Error("no_organization");

  const [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!organization) throw new Error("no_organization");

  const tokens = await listTokens(organizationId);
  const connectorUrl = `${env.APP_URL.replace(/\/$/, "")}/api/mcp`;
  const canPublish = canPublishCustomPages(organization);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold tracking-tight">
          Conectar Claude
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-400">
          Conecta Claude a esta cuenta para trabajar los lanzamientos desde el
          chat: consultar el contexto, generar páginas y —con plan pro—
          diseñarlas en Claude Design y publicarlas diciéndolo. Las páginas
          publicadas así siguen midiendo visitas, capturando leads, cobrando por
          Stripe y atribuyendo a los afiliados: eso lo cablea la plataforma, no
          el diseño.
        </p>
      </header>

      <section
        className={`rounded-xl border p-5 ${
          canPublish
            ? "border-emerald-400/30 bg-emerald-400/5"
            : "border-amber-400/30 bg-amber-400/5"
        }`}
      >
        <div className="text-xs uppercase tracking-widest text-zinc-300">
          Plan de la cuenta: {organization.plan}
        </div>
        <p className="mt-2 text-sm text-zinc-300">
          {canPublish
            ? "Puedes diseñar páginas en Claude Design y publicarlas desde el chat."
            : "Desde el chat puedes consultar los lanzamientos y generar páginas con el sistema de Botón Rojo. Publicar diseño propio (Claude Design) requiere plan pro."}
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
          Tokens
        </h2>
        <McpTokensPanel
          connectorUrl={connectorUrl}
          createAction={createMcpTokenAction}
          revokeAction={revokeMcpTokenAction}
          tokens={tokens.map((t) => ({
            id: t.id,
            label: t.label,
            tokenHint: t.tokenHint,
            createdAt: t.createdAt.toISOString(),
            lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
            revokedAt: t.revokedAt?.toISOString() ?? null,
          }))}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
          Cómo se conecta
        </h2>

        <div className="rounded-xl border border-white/10 bg-black/30 p-5">
          <div className="text-xs uppercase tracking-widest text-zinc-400">
            En Claude Code
          </div>
          <pre className="mt-3 overflow-x-auto rounded-md bg-black/60 p-4 font-[family-name:var(--font-mono)] text-xs text-zinc-200">
            {`claude mcp add boton-rojo ${connectorUrl} \\
  --transport http \\
  --header "Authorization: Bearer TU_TOKEN"`}
          </pre>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-5">
          <div className="text-xs uppercase tracking-widest text-zinc-400">
            En claude.ai (conector propio)
          </div>
          <p className="mt-2 text-sm text-zinc-400">
            Ajustes → Conectores → Añadir conector propio, y pega la URL. Si el
            formulario no deja poner cabeceras, usa la variante con el token
            dentro de la URL:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-black/60 p-4 font-[family-name:var(--font-mono)] text-xs text-zinc-200">
            {`${connectorUrl}/TU_TOKEN`}
          </pre>
          <p className="mt-2 text-xs text-zinc-500">
            Esa forma es más cómoda y menos segura: el token viaja en la URL,
            que queda en historiales y registros. Si la usas, revoca el token en
            cuanto sospeches que se ha visto.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/30 p-5">
          <div className="text-xs uppercase tracking-widest text-zinc-400">
            Qué decirle
          </div>
          <ul className="mt-3 space-y-2 text-sm text-zinc-300">
            <li>“Lista mis lanzamientos.”</li>
            <li>
              “Dame el contexto de factucheck y diseña la página de registro.”
            </li>
            <li>“Publica esa página en registro de factucheck.”</li>
            <li>
              “Genera la página de venta de factucheck con fondo oscuro y la
              caja de compra como protagonista.”
            </li>
            <li>“¿Cómo va factucheck estos 7 días?”</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
