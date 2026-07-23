"use client";

import { useRouter, usePathname } from "next/navigation";

type LaunchOption = { id: string; slug: string; name: string };

const RANGE_OPTIONS = [
  { value: "7", label: "Últimos 7 días" },
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "365", label: "Último año" },
];

export function StatsFiltersBar({
  launches,
  launchId,
  rangeDays,
}: {
  launches: LaunchOption[];
  launchId: string;
  rangeDays: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function update(next: { launchId?: string; rangeDays?: string }) {
    const params = new URLSearchParams();
    params.set("launch", next.launchId ?? launchId);
    params.set("range", next.rangeDays ?? rangeDays);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="glass flex flex-wrap items-center gap-4 p-4">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-xs uppercase tracking-widest text-zinc-500">Lanzamiento</span>
        <select
          value={launchId}
          onChange={(e) => update({ launchId: e.target.value })}
          className="field-input px-3 py-1.5 text-white"
        >
          <option value="all">Todos</option>
          {launches.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-sm">
        <span className="text-xs uppercase tracking-widest text-zinc-500">Rango</span>
        <select
          value={rangeDays}
          onChange={(e) => update({ rangeDays: e.target.value })}
          className="field-input px-3 py-1.5 text-white"
        >
          {RANGE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
