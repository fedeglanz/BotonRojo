"use client";

import { motion } from "framer-motion";
import { SubmitButton } from "@/components/admin/submit-button";
import { LeadForm } from "@/components/public/lead-form";

type Props = {
  launchSlug: string;
  buttonLabel: string;
  hasStripeProduct: boolean;
  productSlug: string | null;
  startCheckoutAction: (formData: FormData) => Promise<void>;
  captureLeadAction: (formData: FormData) => Promise<void>;
};

export function CtaBlock({
  launchSlug,
  buttonLabel,
  hasStripeProduct,
  productSlug,
  startCheckoutAction,
  captureLeadAction,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className="mx-auto max-w-2xl px-6 py-16 text-center"
    >
      {hasStripeProduct && productSlug ? (
        <form action={startCheckoutAction} className="space-y-4">
          <input type="hidden" name="productSlug" value={productSlug} />
          <SubmitButton className="big-red-button" pendingLabel="Redirigiendo…">
            {buttonLabel}
          </SubmitButton>
          <p className="text-xs text-zinc-500">Pago seguro con Stripe</p>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-center text-sm text-zinc-400">
            Apúntate para enterarte cuando se abra el carrito
          </p>
          <LeadForm launchSlug={launchSlug} buttonLabel={buttonLabel} action={captureLeadAction} />
        </div>
      )}
    </motion.div>
  );
}
