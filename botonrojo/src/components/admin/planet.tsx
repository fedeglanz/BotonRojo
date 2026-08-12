import type { BrandPalette } from "@/db/schema/launches";

/**
 * Un lanzamiento, dibujado como un planeta con sus lunas.
 *
 * Las lunas no son adorno: cada una es una página del lanzamiento y su color dice
 * en qué estado está. Así el planeta responde de un vistazo a la pregunta con la que
 * uno entra al panel —qué está terminado y qué está a medias— en vez de obligar a
 * abrir cada lanzamiento para averiguarlo.
 *
 * Todo en CSS con custom properties en vez de SVG por planeta: los colores salen de
 * la paleta de cada lanzamiento, que no se conoce hasta que se pinta, y un degradado
 * radial da la esfera mejor que cualquier dibujo. El bloque global de
 * `prefers-reduced-motion` ya detiene las órbitas.
 */

export type MoonState = "hecha" | "claude" | "pendiente";

const MOON_COLORS: Record<MoonState, string> = {
  // Verde para lo generado, esmeralda claro para lo diseñado en Claude, gris para
  // lo que falta: el mismo código de color que usa el listado de páginas.
  hecha: "#34d399",
  claude: "#6ee7b7",
  pendiente: "#52525b",
};

export function Planet({
  palette,
  fallbackColor,
  moons,
  size = "7rem",
  label,
}: {
  palette: BrandPalette | null;
  /** Cuando el lanzamiento aún no tiene paleta aprobada. */
  fallbackColor: string;
  /** Una por página, en el orden del lanzamiento. */
  moons: MoonState[];
  size?: string;
  label?: string;
}) {
  const planetColor = palette?.primary || fallbackColor;
  const accent = palette?.accent || fallbackColor;

  // Tres anillos como máximo: con más, las lunas se pisan y el planeta se lee como
  // una maraña. Las páginas de sobra se reparten entre los anillos que hay.
  const rings: MoonState[][] = [[], [], []];
  moons.forEach((moon, i) => {
    rings[i % 3]!.push(moon);
  });

  return (
    <div
      className="planet-system"
      style={{
        ["--planet-size" as string]: size,
        ["--planet-color" as string]: planetColor,
      }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {rings.map((ring, index) =>
        ring.length === 0 ? null : (
          <div
            key={index}
            className="planet-orbit"
            data-ring={index + 1}
            aria-hidden
          >
            {ring.map((moon, moonIndex) => (
              <span
                key={moonIndex}
                className="planet-moon"
                style={{
                  ["--moon-color" as string]:
                    moon === "pendiente"
                      ? MOON_COLORS.pendiente
                      : MOON_COLORS[moon],
                  // Repartidas por el anillo: sin esto todas saldrían del mismo
                  // punto y se moverían pegadas.
                  transform: `rotate(${(360 / ring.length) * moonIndex}deg)`,
                  transformOrigin: "50% calc(var(--planet-size) / 2)",
                }}
              />
            ))}
          </div>
        ),
      )}

      <div
        className="planet-body"
        style={{ ["--planet-color" as string]: planetColor }}
        aria-hidden
      />

      {/* Un anillo de acento fijo, sin girar: da la silueta de planeta con anillo
          y usa el segundo color de la marca, que si no no aparecería por ningún
          lado. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[16%] w-[92%] -translate-x-1/2 -translate-y-1/2 rotate-[-18deg] rounded-[50%] border"
        style={{
          borderColor: `color-mix(in srgb, ${accent} 55%, transparent)`,
          boxShadow: `0 0 1.5rem color-mix(in srgb, ${accent} 25%, transparent)`,
        }}
      />
    </div>
  );
}
