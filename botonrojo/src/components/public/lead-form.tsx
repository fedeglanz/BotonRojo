"use client";

import Link from "next/link";
import { SubmitButton } from "@/components/admin/submit-button";

type Props = {
  launchSlug: string;
  buttonLabel: string;
  action: (formData: FormData) => Promise<void>;
  affiliateRef?: string;
};

/**
 * Standalone lead-capture form: name + email + the two mandatory consent
 * checkboxes (privacy policy, marketing opt-in). Self-contained so it can be
 * dropped into a landing CTA, a pop-up, or a lead magnet page without extra
 * wiring — it only needs a launch slug and its capture server action.
 */
export function LeadForm({ launchSlug, buttonLabel, action, affiliateRef }: Props) {
  return (
    <form action={action} className="glass hud-corners mx-auto max-w-md space-y-4 p-6 text-left">
      <input type="hidden" name="launchSlug" value={launchSlug} />
      {affiliateRef && <input type="hidden" name="ref" value={affiliateRef} />}

      <label className="block">
        <span className="block text-xs uppercase tracking-widest text-zinc-400">Nombre</span>
        <input
          type="text"
          name="name"
          required
          placeholder="Tu nombre"
          className="field-input mt-2 w-full px-4 py-3 text-white"
        />
      </label>

      <label className="block">
        <span className="block text-xs uppercase tracking-widest text-zinc-400">Email</span>
        <input
          type="email"
          name="email"
          required
          placeholder="tu@email.com"
          className="field-input mt-2 w-full px-4 py-3 text-white"
        />
      </label>

      <div className="space-y-3 pt-1">
        <label className="flex items-start gap-3 text-xs text-zinc-400">
          <input
            type="checkbox"
            name="privacyAccepted"
            required
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 accent-[--color-red-bright]"
          />
          <span>
            He leído y acepto la{" "}
            <Link href="/privacidad" target="_blank" className="text-[--color-red-bright] hover:underline">
              política de privacidad
            </Link>
            .
          </span>
        </label>

        <label className="flex items-start gap-3 text-xs text-zinc-400">
          <input
            type="checkbox"
            name="marketingConsent"
            required
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-black/40 accent-[--color-red-bright]"
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
