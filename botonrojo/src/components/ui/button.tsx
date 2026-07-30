import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-[#ff3849] to-[#d4172a] text-white shadow-[0_0_24px_-4px_rgba(239,43,61,0.55)] hover:brightness-110",
  ghost: "border border-white/15 bg-white/10 text-zinc-100 hover:border-white/25 hover:bg-white/15",
  outline: "border border-white/20 bg-white/[0.04] text-zinc-100 hover:border-white/40 hover:bg-white/10",
  danger: "bg-red-950 text-red-200 hover:bg-red-900",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold tracking-wide transition disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
    />
  );
}
