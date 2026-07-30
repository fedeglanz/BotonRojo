import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyAffiliateOverview, listPayouts } from "@/server/affiliates";
import { StatCard } from "@/components/affiliate/stat-card";
import { formatDate, formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MisPagosPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const overview = await getMyAffiliateOverview();
  if (!overview) redirect("/");

  const payouts = await listPayouts(session.user.id);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">Pagos</h1>
        <p className="mt-1 text-zinc-400">
          Histórico de pagos recibidos y saldo pendiente. Los pagos los gestiona el administrador.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Comisión generada" value={formatPrice(overview.commissionCents)} hint={`${overview.sales} ventas`} />
        <StatCard label="Total pagado" value={formatPrice(overview.paidCents)} hint={`${payouts.length} pagos`} />
        <StatCard
          label="Saldo a cobrar"
          value={formatPrice(overview.balanceCents)}
          accent={overview.balanceCents > 0 ? "emerald" : "default"}
        />
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
          Histórico
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
                  <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">
                    Aún no se han registrado pagos.
                  </td>
                </tr>
              )}
              {payouts.map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-zinc-300">{formatDate(p.paidAt)}</td>
                  <td className="px-4 py-3 text-zinc-300">{p.launchName ?? <span className="text-zinc-500">—</span>}</td>
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
