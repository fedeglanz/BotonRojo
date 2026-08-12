import { ClaudeButton } from "./claude-button";

type QueueTask = {
  id: string;
  kind: "design_system" | "page";
  pageKey: string | null;
  label: string;
  status: "pending" | "done" | "skipped";
  result: string | null;
};

/**
 * La cola de trabajo de un lanzamiento que se diseña en Claude.
 *
 * Es la respuesta al límite del protocolo: el conector va en una sola dirección, así
 * que Botón Rojo no puede poner a Claude a trabajar. Lo que hace es dejar el trabajo
 * escrito aquí y dar un botón que abre Claude diciéndole que lo recorra; cada tarea
 * se cierra sola cuando el trabajo llega —al guardar la identidad, al publicar la
 * página—, y esta lista es la que va cambiando a verde.
 */
export function ClaudeQueue({
  tasks,
  hasConnector,
  queueHref,
}: {
  tasks: QueueTask[];
  hasConnector: boolean;
  queueHref: string;
}) {
  if (!tasks.length) return null;

  const pending = tasks.filter((task) => task.status === "pending");
  const done = tasks.length - pending.length;

  return (
    <div className="space-y-4 rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-300">
            Este lanzamiento se diseña en Claude
          </div>
          <p className="mt-1 max-w-2xl text-sm text-zinc-300">
            {pending.length === 0
              ? "Todo hecho. Si quieres cambiar algo, entra en la página y dale a “Cambiar en Claude”."
              : `Quedan ${pending.length} de ${tasks.length}. El botón abre Claude con la lista: la va haciendo de una en una y esto se va poniendo en verde.`}
          </p>
        </div>
        {pending.length > 0 && (
          <ClaudeButton
            hasConnector={hasConnector}
            tone="primary"
            label={done === 0 ? "Empezar en Claude" : "Seguir en Claude"}
            href={queueHref}
          />
        )}
      </div>

      <ol className="space-y-1.5">
        {tasks.map((task) => {
          const isDone = task.status === "done";
          return (
            <li key={task.id} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${isDone ? "bg-emerald-400" : "bg-zinc-600"}`}
              />
              <span
                className={
                  isDone ? "text-zinc-500 line-through" : "text-zinc-200"
                }
              >
                {task.label}
              </span>
              {task.kind === "design_system" && (
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
                  Identidad
                </span>
              )}
              {task.result && (
                <span className="truncate font-[family-name:var(--font-mono)] text-[11px] text-zinc-600">
                  {task.result}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <p className="text-xs text-zinc-500">
        La identidad visual va primero: las páginas se diseñan con ella, así que
        hacerlas antes obligaría a repetirlas.
      </p>
    </div>
  );
}
