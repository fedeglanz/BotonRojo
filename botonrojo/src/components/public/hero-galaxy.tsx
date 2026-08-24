import { Planet, type PlanetKind } from "@/components/planet";

/**
 * El fondo de la portada: una galaxia con planetas girando.
 *
 * La primera pantalla decía "Un solo botón. Tu lanzamiento entero." sobre negro
 * plano, y eso es una promesa grande contada en voz baja. Aquí el producto ya
 * dibuja cada lanzamiento como un planeta con sus lunas, así que la portada
 * enseña de qué va antes de leer una palabra — no es adorno traído de fuera, es
 * lo mismo que verás dentro.
 *
 * Cuatro planetas y no doce: cada uno lleva sus órbitas animadas, y a partir de
 * ahí lo que se gana en espectáculo se paga en un móvil que se calienta y en un
 * texto que compite por la atención con el fondo.
 *
 * Cada uno tiene su profundidad —tamaño, opacidad y desenfoque— para que la
 * escena tenga fondo y frente en vez de cuatro pegatinas al mismo nivel. Los de
 * atrás van desenfocados a propósito: el ojo los lee como lejanos y deja de
 * intentar enfocarlos, que es lo que permite leer el titular por encima.
 */

type PlanetaDeFondo = {
  kind: PlanetKind;
  color: string;
  /**
   * Posición y tamaño en unidades relativas a la ventana.
   *
   * El tamaño va en `--tam-planeta` y no en `--planet-size`, que es la que lee el
   * planeta: puestos en el mismo sitio, el componente acabaría declarando
   * `--planet-size: var(--planet-size)` sobre sí mismo —una referencia circular—,
   * y CSS anula la variable entera. El síntoma es que los planetas salen del
   * tamaño por defecto, diminutos, sin ningún error en ninguna parte.
   */
  estilo: React.CSSProperties;
  lunas: number;
  /** Segundos que tarda en completar su flotación; distintos para que no vayan a compás. */
  flotacion: number;
  opacidad: number;
  desenfoque: string;
};

const PLANETAS: PlanetaDeFondo[] = [
  {
    // El grande de la izquierda, el que da la escala de la escena.
    kind: "anillado",
    color: "#8b5cf6",
    estilo: {
      left: "-10vw",
      top: "4vh",
      ["--tam-planeta" as string]: "46vmin",
    },
    lunas: 5,
    flotacion: 34,
    opacidad: 0.9,
    desenfoque: "0px",
  },
  {
    kind: "volcanico",
    color: "#ef4444",
    estilo: {
      right: "-8vw",
      top: "-10vh",
      ["--tam-planeta" as string]: "36vmin",
    },
    lunas: 3,
    flotacion: 41,
    opacidad: 0.75,
    desenfoque: "0.5px",
  },
  {
    kind: "gaseoso",
    color: "#d946ef",
    estilo: {
      right: "6vw",
      bottom: "-6vh",
      ["--tam-planeta" as string]: "26vmin",
    },
    lunas: 4,
    flotacion: 29,
    opacidad: 0.6,
    desenfoque: "1.5px",
  },
  {
    kind: "helado",
    color: "#0ea5e9",
    estilo: {
      left: "18vw",
      bottom: "6vh",
      ["--tam-planeta" as string]: "17vmin",
    },
    lunas: 2,
    flotacion: 47,
    opacidad: 0.5,
    desenfoque: "2.5px",
  },
];

export function HeroGalaxy() {
  return (
    <div className="hero-galaxia galaxy-field" aria-hidden>
      {PLANETAS.map((planeta, i) => (
        <div
          key={i}
          className="hero-galaxia__planeta"
          style={{
            ...planeta.estilo,
            opacity: planeta.opacidad,
            filter: `blur(${planeta.desenfoque})`,
            animationDuration: `${planeta.flotacion}s`,
            // Empezadas a destiempo: arrancando todas a la vez, los cuatro
            // planetas subirían y bajarían como un solo bloque.
            animationDelay: `-${planeta.flotacion / (i + 2)}s`,
          }}
        >
          <Planet
            palette={null}
            fallbackColor={planeta.color}
            kind={planeta.kind}
            moons={Array.from(
              { length: planeta.lunas },
              () => "hecha" as const,
            )}
            size="var(--tam-planeta)"
          />
        </div>
      ))}
    </div>
  );
}
