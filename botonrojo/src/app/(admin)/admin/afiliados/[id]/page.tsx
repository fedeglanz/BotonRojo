import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { launches } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireOrgAdmin } from "@/lib/org";

import {
  getAffiliateOverview,
  getAffiliateLaunchBreakdown,
  listPayouts,
  recordPayoutAction,
  setCommissionRateAction,
} from "@/server/affiliates";
import { StatCard } from "@/components/affiliate/stat-card";
import { SubmitButton } from "@/components/admin/submit-button";
import { formatDate, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AffiliateDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const { organizationId } = await requireOrgAdmin();

  const overview = await getAffiliateOverview(id);
  if (!overview) notFound();

  const breakdown = await getAffiliateLaunchBreakdown(id);
  const payouts = await listPayouts(id);
  const availableLaunches = await db
    .select({ id: launches.id, name: launches.name })
    .from(launches)
    .where(eq(launches.organizationId, organizationId))
    .orderBy(desc(launches.createdAt));

  const rate = ((overview.user.affiliateCommissionRate ?? 0) / 100).toFixed(0);

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/afiliados" className="text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
            ← Afiliados
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
            {overview.user.name ?? overview.user.email}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {overview.user.email} ·{" "}
            <span className="font-[family-name:var(--font-mono)] text-[--color-red-bright]">
              ?ref={overview.user.affiliateCode}
            </span>
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Visitas" value={overview.visits.toLocaleString("es-ES")} />
        <StatCard label="Leads" value={overview.leads.toLocaleString("es-ES")} hint={`${overview.leadConversion.toFixed(1)}% conv.`} />
        <StatCard label="Ventas" value={`${overview.sales}`} hint={formatPrice(overview.salesAmountCents)} accent="red" />
        <StatCard
          label="Pendiente de pago"
          value={formatPrice(overview.balanceCents)}
          hint={`Pagado: ${formatPrice(overview.paidCents)}`}
          accent={overview.balanceCents > 0 ? "emerald" : "default"}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="glass space-y-4 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
            Comisión
          </h2>
          <form action={setCommissionRateAction} className="flex items-center gap-3">
            <input type="hidden" name="userId" value={overview.user.id} />
            <div className="text-3xl font-bold text-white">{rate}%</div>
            <input
              type="number"
              name="commissionPercent"
              min={0}
              max={100}
              step={1}
              defaultValue={rate}
              className="w-24 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
            />
            <SubmitButton variant="outline" pendingLabel="Guardando…">
              Actualizar
            </SubmitButton>
          </form>
        </div>

        <div className="glass space-y-4 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
            Registrar pago
          </h2>
          <form action={recordPayoutAction} className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="userId" value={overview.user.id} />
            <Field label="Importe (céntimos)" name="amountCents" type="number" min={1} required />
            <label className="block">
              <span className="block text-xs uppercase tracking-widest text-zinc-400">Lanzamiento (opc.)</span>
              <select
                name="launchId"
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
              >
                <option value="">—</option>
                {availableLaunches.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Referencia" name="reference" placeholder="Bizum, transferencia, ..." />
            <Field label="Notas" name="notes" />
            <div className="md:col-span-2 flex justify-end">
              <SubmitButton pendingLabel="Guardando…">Registrar pago</SubmitButton>
            </div>
          </form>
        </div>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
          Por lanzamiento
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-widest text-zinc-400">
              <tr>
                <th className="px-4 py-3">Lanzamiento</th>
                <th className="px-4 py-3 text-right">Visitas</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">Ventas</th>
                <th className="px-4 py-3 text-right">Facturado</th>
                <th className="px-4 py-3 text-right">Comisión</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    Sin tráfico atribuido.
                  </td>
                </tr>
              )}
              {breakdown.map((r) => {
                const commission = Math.floor(
                  (r.salesAmountCents * (overview.user.affiliateCommissionRate ?? 0)) / 10000,
                );
                return (
                  <tr key={r.launchId} className="border-t border-white/5">
                    <td className="px-4 py-3 text-white">{r.launchName}</td>
                    <td className="px-4 py-3 text-right text-zinc-300">{r.visits}</td>
                    <td className="px-4 py-3 text-right text-zinc-300">{r.leads}</td>
                    <td className="px-4 py-3 text-right text-white">{r.sales}</td>
                    <td className="px-4 py-3 text-right text-zinc-300">{formatPrice(r.salesAmountCents)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[--color-red-bright]">{formatPrice(commission)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
          Histórico de pagos
        </h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-widest text-zinc-400">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Lanzamiento</th>
                <th className="px-4 py-3">Referencia</th>
                <th className="px-4 py-3">Notas</th>
                <th className="px-4 py-3 text-right">Importe</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    Sin pagos registrados.
                  </td>
                </tr>
              )}
              {payouts.map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-zinc-300">{formatDate(p.paidAt)}</td>
                  <td className="px-4 py-3 text-zinc-300">{p.launchName ?? "—"}</td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs text-zinc-400">
                    {p.reference ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{p.notes ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-bold text-white">
                    {formatPrice(p.amountCents, p.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-zinc-400">{label}</span>
      <input
        {...rest}
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
      />
    </label>
  );
}
