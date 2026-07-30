"use client";

import { motion } from "framer-motion";
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={compact ? { opacity: 1, y: 0 } : undefined}
      whileInView={compact ? undefined : { opacity: 1, y: 0 }}
      viewport={compact ? undefined : { once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
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
