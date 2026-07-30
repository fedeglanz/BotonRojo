import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getMyAffiliateOverview, getAffiliateLaunchBreakdown } from "@/server/affiliates";
import { StatCard } from "@/components/affiliate/stat-card";
import { formatPrice } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AffiliateDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const overview = await getMyAffiliateOverview();
  const breakdown = await getAffiliateLaunchBreakdown(session.user.id);

  if (!overview) redirect("/");

  const rate = ((overview.user.affiliateCommissionRate ?? 0) / 100).toFixed(0);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold md:text-4xl">
          Hola, {overview.user.name ?? overview.user.email}
        </h1>
        <p className="mt-1 text-zinc-400">
          Comisión actual: <span className="text-white">{rate}%</span> sobre ventas atribuidas a tu
          código.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="Visitas" value={overview.visits.toLocaleString("es-ES")} hint="Atribuidas a tu enlace" />
        <StatCard
          label="Leads"
          value={overview.leads.toLocaleString("es-ES")}
          hint={`${overview.leadConversion.toFixed(1)}% conversión`}
        />
        <StatCard
          label="Ventas"
          value={overview.sales.toLocaleString("es-ES")}
          hint={`${formatPrice(overview.salesAmountCents)} facturado`}
          accent="red"
        />
        <StatCard
          label="Saldo a cobrar"
          value={formatPrice(overview.balanceCents)}
          hint={`Pagado: ${formatPrice(overview.paidCents)}`}
          accent={overview.balanceCents > 0 ? "emerald" : "default"}
        />
      </section>

      <section>
        <div className="flex items-end justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
            Por lanzamiento
          </h2>
          <Link href="/afiliado/enlaces" className="text-xs text-[--color-red-bright] hover:underline">
            + Crear enlace →
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs uppercase tracking-widest text-zinc-400">
              <tr>
                <th className="px-4 py-3">Lanzamiento</th>
                <th className="px-4 py-3 text-right">Visitas</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">Ventas</th>
                <th className="px-4 py-3 text-right">Facturado</th>
                <th className="px-4 py-3 text-right">Tu comisión</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                    Aún no hay tráfico atribuido. Crea tu primer enlace en{" "}
                    <Link href="/afiliado/enlaces" className="text-[--color-red-bright] hover:underline">
                      Mis enlaces
                    </Link>
                    .
                  </td>
                </tr>
              )}
              {breakdown.map((r) => {
                const commission = Math.floor((r.salesAmountCents * (overview.user.affiliateCommissionRate ?? 0)) / 10000);
                return (
                  <tr key={r.launchId} className="border-t border-white/5">
                    <td className="px-4 py-3">
                      <div className="text-white">{r.launchName}</div>
                      <div className="font-[family-name:var(--font-mono)] text-xs text-zinc-500">
                        /{r.launchSlug}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-300">{r.visits.toLocaleString("es-ES")}</td>
                    <td className="px-4 py-3 text-right text-zinc-300">{r.leads.toLocaleString("es-ES")}</td>
                    <td className="px-4 py-3 text-right text-white">{r.sales.toLocaleString("es-ES")}</td>
                    <td className="px-4 py-3 text-right text-zinc-300">{formatPrice(r.salesAmountCents)}</td>
                    <td className="px-4 py-3 text-right font-bold text-[--color-red-bright]">{formatPrice(commission)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
