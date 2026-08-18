import Link from "next/link";

export type Paso = {
  titulo: string;
  /** Qué hay que hacer, en una frase y en imperativo. */
  queHacer: string;
  hecho: boolean;
  /** A dónde lleva el botón cuando es el paso que toca. */
  href: string;
  /** Los pasos que no bloquean nada se pueden dejar para después. */
  opcional?: boolean;
};

/**
 * Qué hacer ahora en un lanzamiento, y qué queda por hacer.
 *
 * El panel enseñaba nueve cajas con su estado, que responde "qué falta" pero no
 * "qué hago yo ahora": ante nueve cosas en gris, la respuesta no es evidente y
 * además no todas se pueden hacer en cualquier orden — sin identidad visual no hay
 * páginas, y sin marco de copy no hay nada que escribir en ellas.
 *
 * Esto coge el primer paso pendiente que no sea opcional y lo pone delante. Es el
 * mismo papel que hace la cola en un lanzamiento de Claude; por eso allí no se
 * enseña, para no decir lo mismo dos veces con palabras distintas.
 */
export function ProximosPasos({ pasos }: { pasos: Paso[] }) {
  const pendientes = pasos.filter((paso) => !paso.hecho);
  const ahora = pendientes.find((paso) => !paso.opcional) ?? pendientes[0];
  const hechos = pasos.length - pendientes.length;

  if (!ahora) {
    return (
      <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-5">
        <div className="text-xs uppercase tracking-widest text-emerald-300">
          Lanzamiento listo
        </div>
        <p className="mt-1 text-sm text-zinc-300">
          Todos los pasos están hechos. Lo que toque a partir de aquí es cambiar lo
          que no te guste y abrir el carrito cuando llegue el día.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-red)]/25 bg-[var(--color-red)]/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-red-bright)]">
            Ahora te toca · paso {hechos + 1} de {pasos.length}
          </div>
          <div className="mt-1 font-[family-name:var(--font-display)] text-lg font-bold text-white">
            {ahora.titulo}
          </div>
          <p className="mt-1 max-w-2xl text-sm text-zinc-300">{ahora.queHacer}</p>
        </div>
        <Link
          href={ahora.href}
          className="shrink-0 rounded-lg border border-[var(--color-red)]/40 bg-[var(--color-red)]/15 px-4 py-2 text-sm font-semibold text-[var(--color-red-bright)] transition hover:bg-[var(--color-red)]/25"
        >
          Ir a este paso →
        </Link>
      </div>

      <ol className="grid gap-1.5 sm:grid-cols-2">
        {pasos.map((paso) => (
          <li key={paso.titulo} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                paso.hecho
                  ? "bg-emerald-400"
                  : paso === ahora
                    ? "bg-[var(--color-red-bright)]"
                    : "bg-zinc-700"
              }`}
            />
            <span
              className={
                paso.hecho
                  ? "text-zinc-500 line-through"
                  : paso === ahora
                    ? "font-medium text-white"
                    : "text-zinc-500"
              }
            >
              {paso.titulo}
            </span>
            {paso.opcional && !paso.hecho && (
              <span className="text-[10px] uppercase tracking-widest text-zinc-600">
                opcional
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
