import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  hint?: string;
  accent?: "default" | "red" | "amber" | "emerald";
};

const ACCENTS = {
  default: "from-white/5 to-white/0",
  red: "from-[--color-red]/15 to-[--color-red]/0",
  amber: "from-amber-500/15 to-amber-500/0",
  emerald: "from-emerald-500/15 to-emerald-500/0",
};

export function StatCard({ label, value, hint, accent = "default" }: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b p-5",
        ACCENTS[accent],
      )}
    >
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold text-white">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-zinc-400">{hint}</div>}
    </div>
  );
}
