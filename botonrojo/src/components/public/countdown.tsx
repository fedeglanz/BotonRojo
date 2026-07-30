"use client";

import { useEffect, useState } from "react";

function getRemaining(target: number) {
  const diff = Math.max(0, target - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1_000) % 60),
    done: diff <= 0,
  };
}

/**
 * Renders nothing on the server and fills in on mount — a countdown computed
 * from `Date.now()` would otherwise mismatch between server-render time and
 * client-hydrate time.
 */
export function Countdown({ targetDate }: { targetDate: string }) {
  const target = new Date(targetDate).getTime();
  const [remaining, setRemaining] = useState<ReturnType<typeof getRemaining> | null>(null);

  useEffect(() => {
    setRemaining(getRemaining(target));
    const id = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!remaining || remaining.done) return null;

  const units: Array<[string, number]> = [
    ["d", remaining.days],
    ["h", remaining.hours],
    ["m", remaining.minutes],
    ["s", remaining.seconds],
  ];

  return (
    <div className="flex justify-center gap-4 font-[family-name:var(--font-mono)] text-3xl font-bold md:text-5xl">
      {units.map(([unit, value]) => (
        <div key={unit}>
          {String(value).padStart(2, "0")}
          <span className="ml-1 text-sm text-[--color-muted-3]">{unit}</span>
        </div>
      ))}
    </div>
  );
}
