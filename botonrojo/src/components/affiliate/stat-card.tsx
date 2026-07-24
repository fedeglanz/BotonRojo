import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  hint?: string;
  accent?: "default" | "red" | "amber" | "emerald";
};

const ACCENTS = {
  default: "from-white/[0.06] to-white/0",
  red: "from-[--color-red]/20 to-[--color-red]/0",
  amber: "from-amber-500/20 to-amber-500/0",
  emerald: "from-emerald-500/20 to-emerald-500/0",
};

const GLOWS = {
  default: "rgba(255,255,255,0.12)",
  red: "var(--color-red-glow)",
  amber: "rgba(245,158,11,0.35)",
  emerald: "rgba(16,185,129,0.35)",
};

export function StatCard({ label, value, hint, accent = "default" }: Props) {
  return (
    <div className={cn("glass relative overflow-hidden bg-gradient-to-b p-5", ACCENTS[accent])}>
      <div
        className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl"
        style={{ background: GLOWS[accent] }}
        aria-hidden
      />
      <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div className="mt-2 font-[family-name:var(--font-display)] text-3xl font-extrabold text-white">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-zinc-400">{hint}</div>}
    </div>
  );
}
