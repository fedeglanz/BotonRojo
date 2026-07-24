"use client";

import { SubmitButton } from "@/components/admin/submit-button";
import type { Domain } from "@/db/schema/domains";

type Props = {
  launchId: string;
  launchSlug: string;
  domains: Domain[];
  appHostname: string;
  serverIpv4: string;
  addAction: (formData: FormData) => Promise<void>;
  verifyAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
};

const STATUS_LABEL: Record<Domain["status"], string> = {
  pending: "Pendiente de verificar",
  verifying: "Verificando…",
  active: "Activo",
  failed: "Falló la verificación",
};

const STATUS_COLOR: Record<Domain["status"], string> = {
  pending: "text-zinc-400 border-white/10",
  verifying: "text-amber-300 border-amber-500/40",
  active: "text-emerald-300 border-emerald-500/40",
  failed: "text-red-300 border-red-500/40",
};

export function DomainPanel({
  launchId,
  launchSlug,
  domains,
  appHostname,
  serverIpv4,
  addAction,
  verifyAction,
  removeAction,
}: Props) {
  return (
    <div className="space-y-6">
      <form
        action={addAction}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="launchId" value={launchId} />
        <input type="hidden" name="launchSlug" value={launchSlug} />
        <label className="flex-1 min-w-[220px]">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">
            Dominio o subdominio del cliente
          </span>
          <input
            type="text"
            name="hostname"
            required
            placeholder="lanzamiento.sudominio.com"
            className="field-input mt-2 w-full px-4 py-2.5 text-white"
          />
        </label>
        <SubmitButton pendingLabel="Añadiendo…">Conectar dominio</SubmitButton>
      </form>

      {domains.length === 0 && (
        <p className="text-sm text-zinc-500">
          Aún no hay ningún dominio conectado a este lanzamiento. La landing sigue disponible en{" "}
          <code className="text-[--color-red-bright]">/{launchSlug}</code>.
        </p>
      )}

      <div className="space-y-4">
        {domains.map((d) => (
          <div key={d.id} className="glass p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-[family-name:var(--font-mono)] text-sm text-white">{d.hostname}</div>
                <span
                  className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${STATUS_COLOR[d.status]}`}
                >
                  {STATUS_LABEL[d.status]}
                </span>
              </div>
              <div className="flex gap-2">
                <form action={verifyAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="launchSlug" value={launchSlug} />
                  <SubmitButton variant="outline" pendingLabel="Comprobando…">
                    Verificar DNS
                  </SubmitButton>
                </form>
                <form action={removeAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <input type="hidden" name="launchSlug" value={launchSlug} />
                  <SubmitButton variant="danger" pendingLabel="Quitando…">
                    Quitar
                  </SubmitButton>
                </form>
              </div>
            </div>

            {d.status !== "active" && (
              <div className="mt-4 rounded-lg border border-white/10 bg-black/30 p-4 font-[family-name:var(--font-mono)] text-xs text-zinc-400">
                {d.isApex ? (
                  <>
                    Añade un registro <span className="text-white">A</span> en tu proveedor DNS:
                    <br />
                    <span className="text-zinc-500">Nombre:</span> @ &nbsp;
                    <span className="text-zinc-500">Valor:</span>{" "}
                    <span className="text-[--color-red-bright]">
                      {serverIpv4 || "(configura SERVER_IPV4 en el servidor)"}
                    </span>
                  </>
                ) : (
                  <>
                    Añade un registro <span className="text-white">CNAME</span> en tu proveedor DNS:
                    <br />
                    <span className="text-zinc-500">Nombre:</span> {d.hostname.split(".")[0]} &nbsp;
                    <span className="text-zinc-500">Valor:</span>{" "}
                    <span className="text-[--color-red-bright]">{appHostname}</span>
                  </>
                )}
                {d.lastError && <div className="mt-2 text-red-300">{d.lastError}</div>}
              </div>
            )}

            {d.status === "active" && (
              <p className="mt-3 text-sm text-emerald-300">
                ✓ Sirviendo la landing en{" "}
                <a href={`https://${d.hostname}`} target="_blank" rel="noreferrer" className="underline">
                  https://{d.hostname}
                </a>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
