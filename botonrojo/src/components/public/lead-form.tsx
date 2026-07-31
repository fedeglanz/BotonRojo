"use client";

import Link from "next/link";
import { SubmitButton } from "@/components/admin/submit-button";
import { resolveVisualStyle } from "@/lib/design/presets";
import type { LandingCardStyle } from "@/components/public/landing-types";

type Props = {
  launchSlug: string;
  buttonLabel: string;
  action: (formData: FormData) => Promise<void>;
  affiliateRef?: string;
  /** Tighter padding/spacing for the hero, where the form must fit above the fold. */
  compact?: boolean;
  cardStyle?: LandingCardStyle;
};

/**
 * Standalone lead-capture form: name + email + the two mandatory consent
 * checkboxes (privacy policy, marketing opt-in). Self-contained so it can be
 * dropped into a landing CTA, a pop-up, or a lead magnet page without extra
 * wiring — it only needs a launch slug and its capture server action.
 *
 * "glass" (the default) is always a dark card, so it keeps fixed light-on-dark
 * text/input colors regardless of the page's own palette. Every other card
 * style derives its text/input colors from the page's own foreground instead,
 * since the box itself is no longer guaranteed to be dark.
 */
export function LeadForm({ launchSlug, buttonLabel, action, affiliateRef, compact = false, cardStyle }: Props) {
  const card = resolveVisualStyle(cardStyle);
  const isGlass = (cardStyle ?? "glass") === "glass";

  // Field labels are actionable, not decorative — need more contrast than
  // the general "muted" tone (--color-muted-2 read as too low-contrast in
  // review on light card styles).
  const labelClass = isGlass ? "text-zinc-400" : "text-[--color-text-muted]";
  const inputClass = isGlass
    ? "field-input text-white"
    : "rounded-[--radius-field] border border-[--color-border] bg-[--color-surface] outline-none transition focus:border-[--color-focus]";
  const checkboxClass = isGlass
    ? "border-white/20 bg-black/40"
    : "border-[--color-border-strong] bg-transparent";

  return (
    <form
      action={action}
      className={`${card.box} ${card.hudCorners ? "hud-corners" : ""} mx-auto max-w-md text-left ${compact ? "space-y-2.5 p-4" : "space-y-4 p-6"}`}
    >
      <input type="hidden" name="launchSlug" value={launchSlug} />
      {affiliateRef && <input type="hidden" name="ref" value={affiliateRef} />}

      <label className="block">
        <span className={`block text-xs uppercase tracking-widest ${labelClass}`}>Nombre</span>
        <input
          type="text"
          name="name"
          required
          placeholder="Tu nombre"
          className={`${inputClass} mt-1.5 w-full px-4 ${compact ? "py-2" : "py-3"}`}
        />
      </label>

      <label className="block">
        <span className={`block text-xs uppercase tracking-widest ${labelClass}`}>Email</span>
        <input
          type="email"
          name="email"
          required
          placeholder="tu@email.com"
          className={`${inputClass} mt-1.5 w-full px-4 ${compact ? "py-2" : "py-3"}`}
        />
      </label>

      <div className={compact ? "space-y-1.5" : "space-y-3 pt-1"}>
        <label className={`flex items-start gap-2 text-xs ${labelClass}`}>
          <input
            type="checkbox"
            name="privacyAccepted"
            required
            className={`mt-0.5 h-4 w-4 shrink-0 rounded accent-[--color-red-bright] ${checkboxClass}`}
          />
          <span>
            He leído y acepto la{" "}
            <Link href="/privacidad" target="_blank" className="text-[--color-red-bright] hover:underline">
              política de privacidad
            </Link>
            .
          </span>
        </label>

        <label className={`flex items-start gap-2 text-xs ${labelClass}`}>
          <input
            type="checkbox"
            name="marketingConsent"
            required
            className={`mt-0.5 h-4 w-4 shrink-0 rounded accent-[--color-red-bright] ${checkboxClass}`}
          />
          <span>Sí, quiero recibir comunicaciones por email.</span>
        </label>
      </div>

      <SubmitButton className="big-red-button w-full" pendingLabel="Apuntándote…">
        {buttonLabel}
      </SubmitButton>
    </form>
  );
}
