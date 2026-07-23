import {
  listLaunchesForFilter,
  getFunnelSummary,
  getBreakdown,
  getAffiliateBreakdown,
  getTimeSeries,
  getAdSpendSummary,
  listRecentAdSpend,
  addAdSpendAction,
  getExternalSalesForRange,
  type StatsFilters,
} from "@/server/stats";
import { StatsFiltersBar } from "@/components/admin/stats-filters";
import { TrendChart, BreakdownChart } from "@/components/admin/stats-charts";
import { AdSpendForm } from "@/components/admin/ad-spend-form";
import { StatCard } from "@/components/affiliate/stat-card";

export const dynamic = "force-dynamic";

function formatEuros(cents: number) {
  return (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

type SearchParams = Promise<{ launch?: string; range?: string }>;

export default async function EstadisticasPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const launchId = sp.launch && sp.launch !== "all" ? sp.launch : undefined;
  const rangeDays = Number(sp.range ?? "30") || 30;

  const to = new Date();
  const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const filters: StatsFilters = { launchId, from, to };

  const [
    launches,
    funnel,
    bySource,
    byMedium,
    byCampaign,
    byCountry,
    byAffiliate,
    series,
    adSpendSummary,
    recentSpend,
    externalSales,
  ] = await Promise.all([
    listLaunchesForFilter(),
    getFunnelSummary(filters),
    getBreakdown("source", filters),
    getBreakdown("medium", filters),
    getBreakdown("campaign", filters),
    getBreakdown("country", filters),
    getAffiliateBreakdown(filters),
    getTimeSeries(filters),
    getAdSpendSummary(filters),
    listRecentAdSpend(filters),
    getExternalSalesForRange(filters),
  ]);

  const externalCount = externalSales.reduce((acc, s) => acc + s.count, 0);
  const externalRevenueCents = externalSales.reduce((acc, s) => acc + s.revenueCents, 0);
  const totalRevenueCents = funnel.revenueCents + externalRevenueCents;
  const totalSpendCents = adSpendSummary.spendCents;
  const totalRoas = totalSpendCents > 0 ? totalRevenueCents / totalSpendCents : null;
  const unconfiguredSources = externalSales.filter((s) => !s.configured);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
          Estadísticas
        </h1>
        <p className="mt-2 text-zinc-400">
          Dos paneles por lanzamiento, como en endtrack: ventas + ROAS, y registros + CPL.
        </p>
      </div>

      <StatsFiltersBar launches={launches} launchId={sp.launch ?? "all"} rangeDays={String(rangeDays)} />

      {unconfiguredSources.length > 0 && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          {unconfiguredSources.map((s) => s.label).join(", ")}: conectada pero sin tabla/columna de importe
          configurada — no cuenta en los totales. Configúralo en{" "}
          <a href="/admin/ajustes" className="underline">
            Ajustes
          </a>
          .
        </p>
      )}

      {/* ---------------- PANEL 1: VENTAS Y ROAS ---------------- */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <span className="pulse-dot" />
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">💰 Ventas y ROAS</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Ventas (internas)" value={funnel.sales.toLocaleString("es-ES")} accent="red" />
          <StatCard label="Ventas (fuente externa)" value={externalCount.toLocaleString("es-ES")} />
          <StatCard label="Ingresos totales" value={formatEuros(totalRevenueCents)} accent="emerald" />
          <StatCard label="Gasto en ads" value={formatEuros(totalSpendCents)} accent="amber" />
          <StatCard
            label="ROAS"
            value={totalRoas != null ? `${totalRoas.toFixed(2)}x` : "—"}
            hint={adSpendSummary.cplCents != null ? `CPL ${formatEuros(adSpendSummary.cplCents)}` : "Sin gasto registrado"}
          />
        </div>

        {externalSales.some((s) => s.configured) && (
          <div className="glass p-5">
            <h3 className="text-xs uppercase tracking-widest text-zinc-500">Desglose por fuente externa</h3>
            <div className="mt-3 space-y-2">
              {externalSales
                .filter((s) => s.configured)
                .map((s) => (
                  <div key={s.sourceId} className="flex justify-between text-sm">
                    <span className="text-zinc-300">{s.label}</span>
                    <span className="text-white">
                      {s.count.toLocaleString("es-ES")} ventas · {formatEuros(s.revenueCents)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        <section className="glass p-6">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
            Evolución diaria
          </h3>
          <div className="mt-4">
            <TrendChart data={series} />
          </div>
        </section>

        <section className="glass p-6">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
            Por campaña
          </h3>
          <div className="mt-4">
            <BreakdownChart dimension="campaign" data={byCampaign} />
          </div>
        </section>

        <section className="glass overflow-hidden p-6">
          <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
            Ranking de afiliados
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-zinc-500">
                <tr>
                  <th className="py-2 pr-4">Afiliado</th>
                  <th className="py-2 pr-4">Visitas</th>
                  <th className="py-2 pr-4">Leads</th>
                  <th className="py-2 pr-4">Ventas</th>
                  <th className="py-2 pr-4">Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {byAffiliate.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-zinc-500">
                      Sin actividad de afiliados en este rango.
                    </td>
                  </tr>
                )}
                {byAffiliate.map((a) => (
                  <tr key={a.affiliateId} className="border-t border-white/5">
                    <td className="py-2 pr-4 text-white">{a.name}</td>
                    <td className="py-2 pr-4 text-zinc-400">{a.visits.toLocaleString("es-ES")}</td>
                    <td className="py-2 pr-4 text-zinc-400">{a.leads.toLocaleString("es-ES")}</td>
                    <td className="py-2 pr-4 text-zinc-400">{a.sales.toLocaleString("es-ES")}</td>
                    <td className="py-2 pr-4 text-[--color-red-bright]">{formatEuros(a.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
              Gasto publicitario
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              Entrada manual de gasto en Meta / Google para calcular CPL y ROAS.
            </p>
          </div>

          <AdSpendForm launches={launches} defaultLaunchId={launchId} action={addAdSpendAction} />

          <div className="glass overflow-x-auto p-6">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-widest text-zinc-500">
                <tr>
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Lanzamiento</th>
                  <th className="py-2 pr-4">Canal</th>
                  <th className="py-2 pr-4">Importe</th>
                  <th className="py-2 pr-4">Notas</th>
                </tr>
              </thead>
              <tbody>
                {recentSpend.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-zinc-500">
                      Sin gasto registrado en este rango.
                    </td>
                  </tr>
                )}
                {recentSpend.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="py-2 pr-4 text-zinc-400">{s.spendDate.toString().slice(0, 10)}</td>
                    <td className="py-2 pr-4 text-white">{s.launchName}</td>
                    <td className="py-2 pr-4 text-zinc-400 capitalize">{s.channel}</td>
                    <td className="py-2 pr-4 text-white">{formatEuros(s.amountCents)}</td>
                    <td className="py-2 pr-4 text-zinc-500">{s.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {/* ---------------- PANEL 2: REGISTROS Y CPL ---------------- */}
      <section className="space-y-6 border-t border-white/5 pt-10">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-[#3987e5] shadow-[0_0_10px_rgba(57,135,229,0.6)]" />
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">📝 Registros y CPL</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Visitas" value={funnel.visits.toLocaleString("es-ES")} />
          <StatCard
            label="Registros"
            value={funnel.leads.toLocaleString("es-ES")}
            hint={`${funnel.leadConversion.toFixed(1)}% de visitas`}
            accent="amber"
          />
          <StatCard
            label="CPL"
            value={adSpendSummary.cplCents != null ? formatEuros(adSpendSummary.cplCents) : "—"}
            hint="Coste por registro"
          />
          <StatCard label="Conversión a venta" value={`${funnel.saleConversion.toFixed(1)}%`} hint="de registros a ventas" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <section className="glass p-6">
            <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
              Por fuente
            </h3>
            <div className="mt-4">
              <BreakdownChart dimension="source" data={bySource} />
            </div>
          </section>

          <section className="glass p-6">
            <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
              Por medio
            </h3>
            <div className="mt-4">
              <BreakdownChart dimension="medium" data={byMedium} />
            </div>
          </section>

          <section className="glass p-6">
            <h3 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
              Por país
            </h3>
            <div className="mt-4">
              <BreakdownChart dimension="country" data={byCountry} />
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
