"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DailyPoint, BreakdownRow } from "@/server/stats";

// Fixed categorical slots (never reassigned by rank) — visits/leads share the
// dataviz reference palette's dark-mode order, sales stays the brand red so
// revenue always reads as "the important one."
const SERIES_COLOR = {
  visits: "#3987e5",
  leads: "#d95926",
  sales: "#ff3849",
};

const GRID_STROKE = "rgba(255,255,255,0.08)";
const AXIS_STYLE = { fill: "#a1a1aa", fontSize: 11, fontFamily: "var(--font-mono)" };

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg border border-white/10 px-3 py-2 text-xs">
      <div className="text-zinc-400">{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-white">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {p.value.toLocaleString("es-ES")}
        </div>
      ))}
    </div>
  );
}

export function TrendChart({ data }: { data: DailyPoint[] }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-zinc-500">Sin datos en este rango.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="fillVisits" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_COLOR.visits} stopOpacity={0.35} />
            <stop offset="100%" stopColor={SERIES_COLOR.visits} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="date" tick={AXIS_STYLE} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12, color: "#a1a1aa" }} />
        <Area
          type="monotone"
          dataKey="visits"
          name="Visitas"
          stroke={SERIES_COLOR.visits}
          fill="url(#fillVisits)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="leads"
          name="Leads"
          stroke={SERIES_COLOR.leads}
          fill="transparent"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="sales"
          name="Ventas"
          stroke={SERIES_COLOR.sales}
          fill="transparent"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const DIMENSION_LABEL: Record<string, string> = {
  source: "Fuente",
  medium: "Medio",
  campaign: "Campaña",
  country: "País",
};

export function BreakdownChart({ dimension, data }: { dimension: string; data: BreakdownRow[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-zinc-500">Sin datos en este rango.</p>;
  }
  const height = Math.max(120, data.length * 34);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="key"
          tick={AXIS_STYLE}
          axisLine={false}
          tickLine={false}
          width={110}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="visits" name={`Visitas por ${DIMENSION_LABEL[dimension] ?? dimension}`} fill="#3987e5" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
