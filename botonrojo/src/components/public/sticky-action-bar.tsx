"use client";

import Link from "next/link";
import { Countdown } from "./countdown";

type Props = {
  /** Omit for a bar that's just the CTA, with no countdown. Callers should
   * only pass dates that are actually in the future — a past date renders
   * the CTA alone. */
  targetDate?: string | null;
  countdownLabel?: string;
  ctaLabel: string;
  /** When omitted, the button scrolls to the page's own #cta anchor instead
   * of navigating away. */
  href?: string;
};

export function StickyActionBar({ targetDate, countdownLabel, ctaLabel, href }: Props) {
  const isFuture = Boolean(targetDate && new Date(targetDate).getTime() > Date.now());
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        {isFuture && targetDate ? (
          <div className="min-w-0">
            {countdownLabel && (
              <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted-2)]">{countdownLabel}</div>
            )}
            <div className="scale-[0.6] origin-left sm:scale-75">
              <Countdown targetDate={targetDate} />
            </div>
          </div>
        ) : (
          <span />
        )}

        {href ? (
          <Link href={href} className="big-red-button shrink-0 !px-6 !py-3 !text-sm">
            {ctaLabel}
          </Link>
        ) : (
          <a href="#cta" className="big-red-button shrink-0 !px-6 !py-3 !text-sm">
            {ctaLabel}
          </a>
        )}
      </div>
    </div>
  );
}
