import type { SectionEffect, SectionOrbitItem } from "./landing-types";

/**
 * A ring of items rotating around a glowing core. Stops when hovered or
 * keyboard-focused, and any item with an href is a real <a> so it's reachable
 * by keyboard, not a click handler on a div. Purely CSS-animated: no JS
 * timers, so it costs nothing on the main thread and stops automatically
 * under `prefers-reduced-motion` (see globals.css).
 */
export function SectionOrbitLayer({ items }: { items: SectionOrbitItem[] }) {
  const ring = items.slice(0, 8);
  if (ring.length === 0) return null;

  return (
    // Above the content (z-20), unlike the purely decorative effects: its
    // labels are meant to be hovered and clicked, and content sitting on top
    // would swallow those events. `pointer-events-none` here means only the
    // labels themselves are interactive, so the copy underneath stays
    // selectable everywhere else.
    //
    // The ring and the core glow are NOT here — see SectionOrbitBackdrop. At
    // z-20 the core's blue glow sat on top of the copy and visibly tinted the
    // words it covered.
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="fx-orbit">
        <div className="fx-orbit__spinner">
          {ring.map((item, i) => {
            // Offset by half a step so no label sits dead-centre top or bottom,
            // where it would land on the section's first or last line of copy.
            const step = (2 * Math.PI) / ring.length;
            const angle = step * i + step / 2 - Math.PI / 2;
            const x = `${(50 + 50 * Math.cos(angle)).toFixed(3)}%`;
            const y = `${(50 + 50 * Math.sin(angle)).toFixed(3)}%`;
            return (
              <div
                key={i}
                className="fx-orbit__item"
                style={{ ["--fx-x" as string]: x, ["--fx-y" as string]: y }}
              >
                {item.href ? (
                  <a href={item.href} className="fx-orbit__label">
                    {item.label}
                  </a>
                ) : (
                  // Decorative only — hidden from screen readers, which would
                  // otherwise read a meaningless ring of words.
                  <span className="fx-orbit__label" aria-hidden>
                    {item.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The orbit's decorative half — ring and central glow — drawn behind the
 * content, while the labels ride above it in SectionOrbitLayer. Splitting them
 * is what keeps the copy readable and the labels clickable at the same time.
 */
export function SectionOrbitBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <div className="fx-orbit">
        <div className="fx-orbit__ring" />
        <div className="fx-orbit__core" />
      </div>
    </div>
  );
}

/** Large basic geometry in brand colour — circles, arcs and lines. */
function Geometry() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 800 600"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <g fill="none" stroke="var(--color-accent)" strokeOpacity="0.28">
        <circle cx="120" cy="110" r="170" strokeWidth="1.5" />
        <circle cx="700" cy="520" r="230" strokeWidth="1.5" />
        <path d="M0 480 Q 400 300 800 470" strokeWidth="1.5" />
        <path d="M640 0 L800 160" strokeWidth="1.5" />
      </g>
      <circle cx="700" cy="520" r="60" fill="var(--color-accent)" fillOpacity="0.1" />
      <rect x="70" y="430" width="90" height="90" fill="var(--color-accent)" fillOpacity="0.08" />
    </svg>
  );
}

/**
 * Purely decorative layers, rendered *behind* the content. The orbit is not
 * here — it's interactive, so it ships as SectionOrbitLayer and goes on top.
 */
export function SectionEffectLayer({ effect }: { effect: SectionEffect }) {
  if (effect === "aurora") return <div className="fx-aurora" aria-hidden />;
  if (effect === "grid") return <div className="fx-grid" aria-hidden />;
  if (effect === "geometry") return <Geometry />;
  if (effect === "orbit") return <SectionOrbitBackdrop />;
  return null;
}
