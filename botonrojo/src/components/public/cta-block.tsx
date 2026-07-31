"use client";

import { motion, useReducedMotion } from "framer-motion";
import { SubmitButton } from "@/components/admin/submit-button";
import { LeadForm } from "@/components/public/lead-form";
import type { LandingCardStyle } from "@/components/public/landing-types";

type Props = {
  launchSlug: string;
  buttonLabel: string;
  hasStripeProduct: boolean;
  productSlug: string | null;
  startCheckoutAction: (formData: FormData) => Promise<void>;
  captureLeadAction: (formData: FormData) => Promise<void>;
  /** Tighter vertical padding for the hero, where the form must fit above the fold. */
  compact?: boolean;
  cardStyle?: LandingCardStyle;
};

export function CtaBlock({
  launchSlug,
  buttonLabel,
  hasStripeProduct,
  productSlug,
  startCheckoutAction,
  captureLeadAction,
  compact = false,
  cardStyle,
}: Props) {
  const reduced = useReducedMotion();

  return (
    // `animate`, never `whileInView`, and `animate` is set unconditionally.
    // Two ways this block used to end up permanently invisible — and it holds
    // the page's final CTA, so "invisible" meant no conversion point at all:
    //   1. `whileInView` starting from opacity 0 never fires if the observer
    //      doesn't run (reduced motion, a headless render, an offscreen mount).
    //   2. `useReducedMotion()` returns null on the server, so opacity 0 is
    //      already in the HTML before the preference is known; dropping
    //      `animate` for reduced motion then left nothing to undo it.
    // So the animation always runs and always ends visible — reduced motion
    // only collapses its duration.
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.6 }}
      className={`mx-auto max-w-2xl px-6 text-center ${compact ? "py-4" : "py-16"}`}
    >
      {hasStripeProduct && productSlug ? (
        <form action={startCheckoutAction} className="space-y-4">
          <input type="hidden" name="productSlug" value={productSlug} />
          <SubmitButton className="big-red-button" pendingLabel="Redirigiendo…">
            {buttonLabel}
          </SubmitButton>
          <p className="text-xs text-[--color-muted-3]">Pago seguro con Stripe</p>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-center text-sm text-[--color-muted-2]">
            Apúntate para enterarte cuando se abra el carrito
          </p>
          <LeadForm
            launchSlug={launchSlug}
            buttonLabel={buttonLabel}
            action={captureLeadAction}
            compact={compact}
            cardStyle={cardStyle}
          />
        </div>
      )}
    </motion.div>
  );
}
