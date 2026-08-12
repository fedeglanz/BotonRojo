import Link from "next/link";
import {
  getAllEmailStats,
  getEmailStatsForLaunch,
  listLaunchesWithCampaigns,
  type LaunchEmailStats,
} from "@/server/email-stats";
import { isActiveCampaignConfigured } from "@/integrations/activecampaign";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { StatCard } from "@/components/affiliate/stat-card";
import { EmailLaunchFilter } from "@/components/admin/email-launch-filter";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: "Borrador", color: "text-zinc-400" },
  1: { label: "Programada", color: "text-amber-400" },
  2: { label: "Enviando", color: "text-blue-400" },
  3: { label: "Pausada", color: "text-orange-400" },
  5: { label: "Enviada", color: "text-emerald-400" },
};

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

function num(n: number) {
  return n.toLocaleString("es-ES");
}

type SearchParams = Promise<{ launch?: string }>;

export default async function EmailsPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const { organizationId } = await requireOrgAdmin();
  const acConfigured = await isActiveCampaignConfigured(organizationId);

  if (!acConfigured) {
    return (
      <div className="space-y-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Emails</h1>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          ActiveCampaign no esta configurado. Conectalo desde{" "}
          <Link href="/admin/ajustes" className="underline">Ajustes</Link>{" "}
          para ver las estadisticas de email.
        </div>
      </div>
    );
  }

  const launchesWithCampaigns = await listLaunchesWithCampaigns();
  const launchId = sp.launch && sp.launch !== "all" ? sp.launch : undefined;

  let statsData: LaunchEmailStats[];
  if (launchId) {
    const single = await getEmailStatsForLaunch(launchId);
    statsData = single ? [single] : [];
  } else {
    statsData = await getAllEmailStats();
  }

  // Global totals
  const globalTotals = {
    sends: statsData.reduce((s, l) => s + l.totals.sends, 0),
    uniqueOpens: statsData.reduce((s, l) => s + l.totals.uniqueOpens, 0),
    uniqueClicks: statsData.reduce((s, l) => s + l.totals.uniqueClicks, 0),
    hardBounces: statsData.reduce((s, l) => s + l.totals.hardBounces, 0),
    softBounces: statsData.reduce((s, l) => s + l.totals.softBounces, 0),
    unsubscribes: statsData.reduce((s, l) => s + l.totals.unsubscribes, 0),
  };
  const gSends = globalTotals.sends;
  const globalRates = {
    openRate: gSends > 0 ? (globalTotals.uniqueOpens / gSends) * 100 : 0,
    clickRate: gSends > 0 ? (globalTotals.uniqueClicks / gSends) * 100 : 0,
    bounceRate: gSends > 0 ? ((globalTotals.hardBounces + globalTotals.softBounces) / gSends) * 100 : 0,
    unsubRate: gSends > 0 ? (globalTotals.unsubscribes / gSends) * 100 : 0,
  };

  const totalCampaigns = statsData.reduce((s, l) => s + l.campaigns.length, 0);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
          Emails
        </h1>
        <p className="mt-2 text-zinc-400">
          Estadisticas de campanas de email de ActiveCampaign por lanzamiento.
        </p>
      </div>

      {/* Filter bar — reuses the same component as Estadísticas but only launch filter */}
      <div className="glass flex flex-wrap items-center gap-4 p-4">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-xs uppercase tracking-widest text-zinc-500">Lanzamiento</span>
          <EmailLaunchFilter launches={launchesWithCampaigns} current={sp.launch ?? "all"} />
        </label>
      </div>

      {statsData.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-black/30 p-8 text-center text-sm text-zinc-500">
          {launchId
            ? "Este lanzamiento no tiene campanas creadas en ActiveCampaign."
            : "No hay campanas de email creadas en ningun lanzamiento. Crea campanas desde el paso de ActiveCampaign en cada lanzamiento."}
        </div>
      ) : (
        <>
          {/* Global summary cards */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[var(--color-red)] shadow-[0_0_10px_var(--color-red-glow)]" />
              <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
                Resumen {launchId ? "" : "global"}
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <StatCard label="Campanas" value={num(totalCampaigns)} />
              <StatCard label="Enviados" value={num(globalTotals.sends)} accent="emerald" />
              <StatCard label="Tasa apertura" value={pct(globalRates.openRate)} accent="amber" />
              <StatCard label="Tasa clics" value={pct(globalRates.clickRate)} accent="red" />
              <StatCard label="Tasa rebote" value={pct(globalRates.bounceRate)} />
              <StatCard label="Desuscripciones" value={num(globalTotals.unsubscribes)} />
            </div>
          </section>

          {/* Per-launch breakdown */}
          {statsData.map((launch) => (
            <section key={launch.launchId} className="space-y-4 border-t border-white/5 pt-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-[#3987e5] shadow-[0_0_10px_rgba(57,135,229,0.6)]" />
                  <h2 className="font-[family-name:var(--font-display)] text-lg font-bold">
                    {launch.launchName}
                  </h2>
                </div>
                <Link
                  href={`/admin/lanzamientos/${launch.launchSlug}`}
                  className="text-xs text-zinc-500 hover:text-white transition"
                >
                  Ir al lanzamiento →
                </Link>
              </div>

              {/* Launch totals */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <MiniStat label="Enviados" value={num(launch.totals.sends)} />
                <MiniStat label="Aperturas unicas" value={`${num(launch.totals.uniqueOpens)} (${pct(launch.totals.openRate)})`} />
                <MiniStat label="Clics unicos" value={`${num(launch.totals.uniqueClicks)} (${pct(launch.totals.clickRate)})`} />
                <MiniStat label="Rebotes" value={`${num(launch.totals.hardBounces + launch.totals.softBounces)} (${pct(launch.totals.bounceRate)})`} />
                <MiniStat label="Desuscrip." value={`${num(launch.totals.unsubscribes)} (${pct(launch.totals.unsubRate)})`} />
              </div>

              {/* Campaign table */}
              <div className="glass overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[10px] uppercase tracking-widest text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Campana</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3 text-right">Envios</th>
                      <th className="px-4 py-3 text-right">Aperturas</th>
                      <th className="px-4 py-3 text-right">% Apert.</th>
                      <th className="px-4 py-3 text-right">Clics</th>
                      <th className="px-4 py-3 text-right">% Clics</th>
                      <th className="px-4 py-3 text-right">Rebotes</th>
                      <th className="px-4 py-3 text-right">Desuscrip.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {launch.campaigns.map((c) => {
                      const st = STATUS_LABELS[c.status] ?? { label: `#${c.status}`, color: "text-zinc-500" };
                      return (
                        <tr key={c.campaignId} className="border-t border-white/5">
                          <td className="max-w-[240px] truncate px-4 py-3 text-white" title={c.name}>
                            {c.name}
                          </td>
                          <td className={`px-4 py-3 text-xs ${st.color}`}>{st.label}</td>
                          <td className="px-4 py-3 text-xs text-zinc-400">
                            {c.scheduledDate
                              ? new Date(c.scheduledDate).toLocaleDateString("es-AR", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-300">{num(c.sends)}</td>
                          <td className="px-4 py-3 text-right text-zinc-300">{num(c.uniqueOpens)}</td>
                          <td className="px-4 py-3 text-right font-medium text-amber-400">
                            {c.sends > 0 ? pct(c.openRate) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-300">{num(c.uniqueClicks)}</td>
                          <td className="px-4 py-3 text-right font-medium text-[var(--color-red-bright)]">
                            {c.sends > 0 ? pct(c.clickRate) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-400">
                            {num(c.hardBounces + c.softBounces)}
                          </td>
                          <td className="px-4 py-3 text-right text-zinc-400">{num(c.unsubscribes)}</td>
                        </tr>
                      );
                    })}
                    {launch.campaigns.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-6 text-center text-zinc-500">
                          Sin campanas activas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

