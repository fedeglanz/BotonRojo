"use client";

import { SubmitButton } from "@/components/admin/submit-button";

type LaunchOption = { id: string; slug: string; name: string };

type SourceRow = {
  id: string;
  launchId: string;
  launchName: string;
  label: string;
  kind: "mysql" | "postgres";
  host: string;
  port: number;
  database: string;
  salesTableHint: string | null;
  amountColumn: string | null;
  dateColumn: string | null;
  amountDivisor: number;
  extraFilterSql: string | null;
  lastCheckedAt: Date | null;
  lastCheckOk: boolean | null;
  lastCheckMessage: string | null;
};

export function ExternalSalesPanel({
  launches,
  sources,
  addAction,
  testAction,
  removeAction,
  updateColumnsAction,
}: {
  launches: LaunchOption[];
  sources: SourceRow[];
  addAction: (formData: FormData) => Promise<void>;
  testAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
  updateColumnsAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <form action={addAction} className="glass grid gap-3 p-5 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
          Lanzamiento
          <select name="launchId" required defaultValue="" className="field-input px-3 py-2 text-sm text-white">
            <option value="" disabled>
              Elige…
            </option>
            {launches.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
          Nombre
          <input type="text" name="label" required placeholder="ThriveCart legacy" className="field-input px-3 py-2 text-sm text-white" />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
          Motor
          <select name="kind" required className="field-input px-3 py-2 text-sm text-white">
            <option value="mysql">MySQL</option>
            <option value="postgres">PostgreSQL</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
          Host
          <input type="text" name="host" required placeholder="db.clientedomain.com" className="field-input px-3 py-2 text-sm text-white" />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
          Puerto
          <input type="number" name="port" required defaultValue={3306} className="field-input px-3 py-2 text-sm text-white" />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
          Base de datos
          <input type="text" name="database" required className="field-input px-3 py-2 text-sm text-white" />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
          Usuario
          <input type="text" name="username" required className="field-input px-3 py-2 text-sm text-white" />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
          Contraseña
          <input type="password" name="password" required className="field-input px-3 py-2 text-sm text-white" />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
          Tabla de ventas
          <input type="text" name="salesTableHint" placeholder="wp_datos" className="field-input px-3 py-2 text-sm text-white" />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
          Columna de importe
          <input type="text" name="amountColumn" placeholder="total" className="field-input px-3 py-2 text-sm text-white" />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
          Columna de fecha
          <input type="text" name="dateColumn" placeholder="fecha" className="field-input px-3 py-2 text-sm text-white" />
        </label>

        <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
          El importe está en
          <select name="amountDivisor" defaultValue="1" className="field-input px-3 py-2 text-sm text-white">
            <option value="1">Euros (97.00)</option>
            <option value="100">Céntimos (9700)</option>
          </select>
        </label>

        <p className="text-xs text-zinc-500 md:col-span-3">
          Sin tabla + columna de importe solo se comprueba la conexión. Con ambas, se calculan
          ventas e ingresos reales de esa fuente en Estadísticas.
        </p>

        <div className="md:col-span-3">
          <SubmitButton pendingLabel="Guardando…">Conectar fuente de ventas</SubmitButton>
        </div>
      </form>

      {sources.length === 0 && (
        <p className="text-sm text-zinc-500">
          Sin fuentes de ventas externas conectadas. Úsalo cuando un lanzamiento venda a través de
          una plataforma o sitio distinto de este (por ejemplo, un WordPress/ThriveCart heredado).
        </p>
      )}

      <div className="space-y-3">
        {sources.map((s) => (
          <div key={s.id} className="glass p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-white">
                  {s.label} <span className="text-zinc-500">· {s.launchName}</span>
                </div>
                <div className="font-[family-name:var(--font-mono)] text-xs text-zinc-500">
                  {s.kind} · {s.host}:{s.port}/{s.database}
                  {s.salesTableHint && ` · ${s.salesTableHint}`}
                </div>
              </div>
              <div className="flex gap-2">
                <form action={testAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton variant="outline" pendingLabel="Probando…">
                    Probar conexión
                  </SubmitButton>
                </form>
                <form action={removeAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton variant="danger" pendingLabel="Quitando…">
                    Quitar
                  </SubmitButton>
                </form>
              </div>
            </div>
            {s.lastCheckedAt && (
              <p className={`mt-2 text-sm ${s.lastCheckOk ? "text-emerald-300" : "text-red-300"}`}>
                {s.lastCheckOk ? "✓" : "✗"} {s.lastCheckMessage}
              </p>
            )}

            <form action={updateColumnsAction} className="mt-4 grid gap-2 border-t border-white/5 pt-4 sm:grid-cols-5">
              <input type="hidden" name="id" value={s.id} />
              <input
                type="text"
                name="salesTableHint"
                defaultValue={s.salesTableHint ?? ""}
                placeholder="Tabla (pdc_pagos)"
                className="field-input px-3 py-1.5 text-xs text-white"
              />
              <input
                type="text"
                name="amountColumn"
                defaultValue={s.amountColumn ?? ""}
                placeholder="Columna importe"
                className="field-input px-3 py-1.5 text-xs text-white"
              />
              <input
                type="text"
                name="dateColumn"
                defaultValue={s.dateColumn ?? ""}
                placeholder="Columna fecha"
                className="field-input px-3 py-1.5 text-xs text-white"
              />
              <input
                type="text"
                name="extraFilterSql"
                defaultValue={s.extraFilterSql ?? ""}
                placeholder="Filtro extra: estado IN ('Compra','Completado')"
                className="field-input px-3 py-1.5 text-xs text-white"
              />
              <div className="flex gap-2">
                <select name="amountDivisor" defaultValue={String(s.amountDivisor)} className="field-input px-2 py-1.5 text-xs text-white">
                  <option value="1">€</option>
                  <option value="100">cts</option>
                </select>
                <SubmitButton variant="outline" pendingLabel="…" className="text-xs">
                  Guardar
                </SubmitButton>
              </div>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
