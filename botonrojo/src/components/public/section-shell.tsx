import { resolveSectionDesign } from "./section-design";
import { SectionEffectLayer, SectionOrbitLayer } from "./section-effects";
import type { SectionDesign } from "./landing-types";

/**
 * Wraps a section from the outside to apply background, decoration, full
 * height and width overrides. Wrapping (rather than adding props to all 14
 * section components, 6 of which don't even take `cardStyle`) keeps every
 * existing section untouched.
 *
 * With a default design it returns the child as-is — no extra DOM, so pages
 * that never asked for section design render exactly as before.
 */
export function SectionShell({
  design,
  children,
}: {
  design?: SectionDesign | null;
  children: React.ReactNode;
}) {
  const resolved = resolveSectionDesign(design);
  if (resolved.isDefault) return <>{children}</>;

  return (
    <div className={resolved.wrapperClass}>
      {resolved.background === "photo" && resolved.imageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolved.imageUrl}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Scrim: without it, text over an arbitrary photo fails contrast. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--color-bg)_72%,transparent)]"
          />
        </>
      )}

      <SectionEffectLayer effect={resolved.effect} />

      {/* Content sits above the background and decoration layers. */}
      <div className="relative z-10 w-full">{children}</div>

      {resolved.effect === "orbit" && <SectionOrbitLayer items={resolved.orbitItems ?? []} />}
    </div>
  );
}
