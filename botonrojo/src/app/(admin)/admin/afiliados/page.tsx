import Link from "next/link";
import { getAllAffiliatesOverview } from "@/server/affiliates";
import { formatPrice } from "@/lib/utils";
import { requireOrgAdmin } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function AfiliadosPage() {
  const { organizationId } = await requireOrgAdmin();
  const list = await getAllAffiliatesOverview(organizationId);

  const totals = list.reduce(
    (acc, o) => ({
      sales: acc.sales + o.sales,
      revenue: acc.revenue + o.salesAmountCents,
      commission: acc.commission + o.commissionCents,
      paid: acc.paid + o.paidCents,
      balance: acc.balance + o.balanceCents,
    }),
    { sales: 0, revenue: 0, commission: 0, paid: 0, balance: 0 },
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Afiliados</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {list.length} afiliados · {totals.sales} ventas · {formatPrice(totals.balance)} pendiente de pagar
          </p>
        </div>
        <Link
          href="/admin/afiliados/nuevo"
          className="rounded-lg bg-gradient-to-b from-[#ff3849] to-[#d4172a] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_24px_-4px_rgba(239,43,61,0.55)]"
        >
          + Nuevo afiliado
        </Link>
      </header>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-widest text-zinc-400">
            <tr>
              <th className="px-4 py-3">Afiliado</th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3 text-right">Comisión</th>
              <th className="px-4 py-3 text-right">Ventas</th>
              <th className="px-4 py-3 text-right">Facturado</th>
              <th className="px-4 py-3 text-right">Generado</th>
              <th className="px-4 py-3 text-right">Pagado</th>
              <th className="px-4 py-3 text-right">Pendiente</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                  Aún no hay afiliados.{" "}
                  <Link href="/admin/afiliados/nuevo" className="text-[--color-red-bright] hover:underline">
                    Crea el primero
                  </Link>
                  .
                </td>
              </tr>
            )}
            {list.map((o) => (
              <tr key={o.user.id} className="border-t border-white/5 transition hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="text-white">{o.user.name ?? "—"}</div>
                  <div className="text-xs text-zinc-500">{o.user.email}</div>
                </td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-[--color-red-bright]">
                  ?ref={o.user.affiliateCode}
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">
                  {((o.user.affiliateCommissionRate ?? 0) / 100).toFixed(0)}%
                </td>
                <td className="px-4 py-3 text-right text-white">{o.sales}</td>
                <td className="px-4 py-3 text-right text-zinc-300">{formatPrice(o.salesAmountCents)}</td>
                <td className="px-4 py-3 text-right text-zinc-300">{formatPrice(o.commissionCents)}</td>
                <td className="px-4 py-3 text-right text-zinc-400">{formatPrice(o.paidCents)}</td>
                <td className={`px-4 py-3 text-right font-bold ${o.balanceCents > 0 ? "text-emerald-400" : "text-zinc-500"}`}>
                  {formatPrice(o.balanceCents)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/afiliados/${o.user.id}`} className="text-[--color-red-bright] hover:underline">
                    Abrir →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
