import Link from "next/link";
import { cn } from "@/lib/utils";

export type LaunchTab = {
  id: string;
  label: string;
  /** Steps in this group that are finished, over the total. */
  done: number;
  total: number;
  /** True when nothing in the group can be worked on yet. */
  blocked?: boolean;
};

/**
 * Groups the launch's steps into a handful of sections. Before this the hub was
 * one long scroll of eight panels — everything visible at once meant nothing had
 * an order.
 *
 * Navigation goes through the URL (`?seccion=`) rather than client state, so a
 * section is linkable, the back button works, and each server action's
 * revalidate returns you to the section you were in. Only the active group is
 * rendered, which also cuts the queries and AI panels the page mounts.
 *
 * Dos cosas que no son estética:
 *
 * · **Se queda pegada arriba.** Los paneles de una sección son largos; sin esto,
 *   a media pantalla ya no se veía en qué sección estabas ni qué quedaba, y para
 *   cambiar había que subir del todo.
 * · **Una cajita por paso**, en vez de "2/3". Un contador hay que leerlo y
 *   dividirlo; las cajitas se cuentan de un vistazo, y cuando el grupo está
 *   entero el botón se pone en verde con su marca, que es la diferencia que más
 *   se busca: qué llevo hecho.
 */
export function LaunchTabs({
  tabs,
  active,
  basePath,
}: {
  tabs: LaunchTab[];
  active: string;
  basePath: string;
}) {
  return (
    <nav
      aria-label="Secciones del lanzamiento"
      /* El negativo y el padding compensan el desplazamiento del sticky: sin ellos
         el borde de los botones queda cortado al pegarse arriba. */
      className="sticky top-0 z-30 -mx-2 -mt-2 border-b border-white/5 bg-[var(--color-bg)]/90 px-2 py-3 backdrop-blur-md"
    >
      {/* Scrolls sideways on a phone instead of wrapping into three ragged rows. */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const complete = tab.total > 0 && tab.done === tab.total;

          return (
            <Link
              key={tab.id}
              href={`${basePath}?seccion=${tab.id}`}
              aria-current={isActive ? "page" : undefined}
              title={`${tab.done} de ${tab.total} hecho`}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg border px-4 py-2.5 text-sm transition",
                complete
                  ? isActive
                    ? "border-emerald-400/60 bg-emerald-400/15 text-white"
                    : "border-emerald-400/30 bg-emerald-400/[0.07] text-emerald-200 hover:border-emerald-400/50"
                  : isActive
                    ? "border-[var(--color-red)]/50 bg-[var(--color-red)]/10 text-white"
                    : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200",
              )}
            >
              <span className="font-medium">{tab.label}</span>

              {complete ? (
                <span
                  aria-hidden
                  className="text-xs font-bold text-emerald-400"
                >
                  ✓
                </span>
              ) : (
                <span aria-hidden className="flex items-center gap-1">
                  {Array.from({ length: tab.total }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-2 w-2 rounded-[3px]",
                        i < tab.done
                          ? "bg-emerald-400"
                          : tab.blocked
                            ? "border border-zinc-700"
                            : "border border-white/25",
                      )}
                    />
                  ))}
                </span>
              )}

              <span className="sr-only">
                {tab.done} de {tab.total} hecho
                {tab.blocked ? ", pendiente de un paso anterior" : ""}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
