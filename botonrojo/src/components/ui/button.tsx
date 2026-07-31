import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

/** `none` opts out of the base and variant classes entirely, for callers that
 *  bring a complete treatment of their own — the public CTA presets. Without it
 *  the variant's gradient painted over the preset's background colour, so a blue
 *  brand still shipped a red button. */
type Variant = "primary" | "ghost" | "outline" | "danger" | "none";

const VARIANTS: Record<Variant, string> = {
  // Semantic vars, not fixed hex: this component is used on public pages too,
  // where the colour has to follow the launch's palette. The @theme defaults
  // keep the admin red.
  primary:
    "bg-[var(--color-primary)] text-[var(--color-text-on-accent)] shadow-[0_0_24px_-4px_var(--color-accent-glow)] hover:brightness-110",
  ghost: "border border-white/15 bg-white/10 text-zinc-100 hover:border-white/25 hover:bg-white/15",
  outline: "border border-white/20 bg-white/[0.04] text-zinc-100 hover:border-white/40 hover:bg-white/10",
  danger: "bg-red-950 text-red-200 hover:bg-red-900",
  none: "",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold tracking-wide transition";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={cn(
        variant === "none" ? "" : BASE,
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
    />
  );
}
