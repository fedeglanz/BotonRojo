"use client";

import { useRouter, usePathname } from "next/navigation";

type LaunchOption = { id: string; slug: string; name: string };

export function EmailLaunchFilter({
  launches,
  current,
}: {
  launches: LaunchOption[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      value={current}
      onChange={(e) => {
        const params = new URLSearchParams();
        params.set("launch", e.target.value);
        router.push(`${pathname}?${params.toString()}`);
      }}
      className="field-input px-3 py-1.5 text-white"
    >
      <option value="all">Todos los lanzamientos</option>
      {launches.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
