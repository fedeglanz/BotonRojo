import type { BrandPalette } from "@/db/schema/launches";

/**
 * Un lanzamiento, dibujado como un planeta con sus lunas.
 *
 * Dos cosas que se leen de un vistazo y por eso no son adorno:
 *
 * · **Qué tipo de lanzamiento es**, por la superficie del planeta. Cada tipo tiene su
 *   mundo —volcánico, gaseoso, anillado, helado— en vez del mismo degradado en cuatro
 *   colores, que se leía como cuatro copias del mismo planeta.
 * · **Qué está hecho**, por las lunas: cada una es una página. El color identifica a
 *   la luna y el brillo dice su estado, encendida o apagada. Antes el color decía el
 *   estado, y eso impedía que cada luna tuviera el suyo.
 *
 * Todo en CSS con custom properties en vez de un SVG por planeta: los colores salen de
 * la paleta de cada lanzamiento y no se conocen hasta que se pinta. El bloque global de
 * `prefers-reduced-motion` ya detiene las órbitas.
 */

export type MoonState = "hecha" | "claude" | "pendiente";

/** El mundo de cada tipo de lanzamiento. */
export type PlanetKind = "volcanico" | "gaseoso" | "anillado" | "helado";

/**
 * Los colores de las lunas.
 *
 * Una rueda de tonos bien separados entre sí: se recorren en orden, así que dos lunas
 * seguidas nunca son del mismo color aunque el planeta tenga ocho páginas. No salen de
 * la paleta de la marca a propósito — una paleta de marca son dos o tres colores
 * próximos, y con ellos las lunas volverían a parecer la misma repetida.
 */
const MOON_COLORS = [
  "#34d399",
  "#f59e0b",
  "#38bdf8",
  "#f472b6",
  "#a78bfa",
  "#facc15",
  "#fb7185",
  "#2dd4bf",
];

export function Planet({
  palette,
  fallbackColor,
  kind,
  moons,
  size = "7rem",
  label,
}: {
  palette: BrandPalette | null;
  /** Cuando el lanzamiento aún no tiene paleta aprobada. */
  fallbackColor: string;
  kind: PlanetKind;
  /** Una por página, en el orden del lanzamiento. */
  moons: MoonState[];
  size?: string;
  label?: string;
}) {
  const planetColor = palette?.primary || fallbackColor;
  const accent = palette?.accent || fallbackColor;

  // Tres anillos como máximo: con más, las lunas se pisan y el planeta se lee como una
  // maraña. Las de sobra se reparten entre los que hay.
  const rings: Array<Array<{ state: MoonState; color: string }>> = [[], [], []];
  moons.forEach((state, i) => {
    rings[i % 3]!.push({ state, color: MOON_COLORS[i % MOON_COLORS.length]! });
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
                data-state={moon.state}
                style={{
                  ["--moon-color" as string]: moon.color,
                  // Repartidas por el anillo: sin esto todas saldrían del mismo punto
                  // y se moverían pegadas.
                  transform: `rotate(${(360 / ring.length) * moonIndex}deg)`,
                  transformOrigin: "50% calc(var(--planet-size) / 2)",
                }}
              />
            ))}
          </div>
        ),
      )}

      <div className="planet-body" data-kind={kind} aria-hidden />

      {/* El anillo es lo que identifica al planeta anillado, así que solo lo lleva él:
          puesto en todos, los cuatro volverían a parecerse. */}
      {kind === "anillado" && (
        <>
          <div
            className="planet-ring"
            style={{ ["--ring-color" as string]: accent }}
            aria-hidden
          />
          <div
            className="planet-ring"
            data-ring="outer"
            style={{ ["--ring-color" as string]: accent }}
            aria-hidden
          />
        </>
      )}
    </div>
  );
}
