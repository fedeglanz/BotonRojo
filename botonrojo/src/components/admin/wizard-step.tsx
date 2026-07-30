import { cn } from "@/lib/utils";

type Props = {
  index: number;
  title: string;
  subtitle?: string;
  status: "empty" | "ready" | "pending" | "needs-prev";
  children: React.ReactNode;
  action?: React.ReactNode;
};

const STATUS_STYLES = {
  empty: "border-white/10 bg-white/[0.02]",
  ready: "border-[--color-red]/30 bg-[--color-red]/5",
  pending: "border-amber-500/30 bg-amber-500/5",
  "needs-prev": "border-white/5 bg-white/[0.015] opacity-60",
};

const STATUS_LABELS: Record<Props["status"], string> = {
  empty: "Pendiente",
  ready: "Listo",
  pending: "Procesando",
  "needs-prev": "Bloqueado",
};

export function WizardStep({ index, title, subtitle, status, children, action }: Props) {
  return (
    <section className={cn("glass p-6", STATUS_STYLES[status])}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="font-[family-name:var(--font-mono)] text-xs text-zinc-500">
            {String(index).padStart(2, "0")}
          </div>
          <div>
            <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
              status === "ready" && "border-[--color-red]/40 text-[--color-red-bright]",
              status === "empty" && "border-white/10 text-zinc-500",
              status === "pending" && "border-amber-500/40 text-amber-300",
              status === "needs-prev" && "border-white/5 text-zinc-600",
            )}
          >
            {STATUS_LABELS[status]}
          </span>
          {action}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}
