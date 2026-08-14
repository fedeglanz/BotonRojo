import { ClaudeGoButton } from "./claude-go-button";
import { CopyPromptButton } from "./copy-prompt-button";

type QueueTask = {
  id: string;
  kind: "design_system" | "page";
  pageKey: string | null;
  label: string;
  status: "pending" | "done" | "skipped";
  result: string | null;
};

/** Lo que las páginas necesitan y solo puede decidir el cliente. */
type Missing = {
  /** Promesa y avatar: sin ellos las páginas salen genéricas. */
  copy: boolean;
  /** Fechas de cierre: la cuenta atrás no puede inventarlas. */
  dates: boolean;
};

/**
 * La cola de trabajo de un lanzamiento que se diseña en Claude.
 *
 * Es la respuesta a un límite del protocolo: el conector va en una sola dirección,
 * así que Botón Rojo no puede poner a Claude a trabajar. Lo que hace es dejar el
 * trabajo escrito y dar la instrucción hecha; cada tarea se cierra sola cuando el
 * trabajo llega —al guardar la identidad, al publicar la página— y esta lista es la
 * que va cambiando a verde.
 *
 * Los pasos están escritos aquí, y no solo dentro del mensaje que se manda a Claude,
 * porque la primera vez la pregunta no es "qué le digo" sino "qué va a pasar y cómo
 * vuelve esto a Botón Rojo".
 */
export function ClaudeQueue({
  tasks,
  hasConnector,
  queueHref,
  queuePrompt,
  missing,
  launchSlug,
}: {
  tasks: QueueTask[];
  hasConnector: boolean;
  queueHref: string;
  queuePrompt: string;
  missing: Missing;
  launchSlug: string;
}) {
  if (!tasks.length) return null;

  const pending = tasks.filter((task) => task.status === "pending");
  const done = tasks.length - pending.length;
  const finished = pending.length === 0;

  const identity = tasks.find((task) => task.kind === "design_system");
  const identityDone = identity?.status !== "pending";
  const nextPage = pending.find((task) => task.kind === "page");

  /**
   * Una sola frase: qué le toca hacer a la persona AHORA.
   *
   * La cola decía lo que falta, que no es lo mismo. Ante "quedan 3 de 3" la
   * pregunta sigue siendo "y yo qué hago", y la respuesta cambia según el momento:
   * abrir Claude, decirle que sí, rellenar unas fechas o nada.
   */
  const nextStep = !identityDone
    ? done === 0
      ? "Abre Claude con el botón. Te propondrá los colores y las tipografías; cuando te gusten, dile “sí, guárdala” y aparecerán aquí."
      : "En Claude: cuando te guste la identidad, dile “sí, guárdala”."
    : missing.copy
      ? "Antes de las páginas, rellena la promesa y el avatar en “Marco de copy”: sin eso las páginas salen genéricas."
      : nextPage
        ? `En Claude: dile que siga con “${nextPage.label}”. Te la enseñará antes de publicarla.`
        : "Nada. Todo hecho.";

  return (
    <div className="space-y-4 rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-300">
            Este lanzamiento se diseña en Claude
          </div>
          <p className="mt-1 max-w-2xl text-sm text-zinc-300">
            {finished
              ? "Todo hecho. Para cambiar algo, entra en la página y dale a “Cambiar en Claude”."
              : `Quedan ${pending.length} de ${tasks.length}. Claude las hace de una en una y esto se va poniendo en verde solo.`}
          </p>
        </div>
        {!finished && (
          <ClaudeGoButton
            hasConnector={hasConnector}
            label={done === 0 ? "Abrir Claude Design" : "Seguir en Claude"}
            href={queueHref}
            prompt={queuePrompt}
          />
        )}
      </div>

      {!finished && (
        <div className="rounded-lg border border-[var(--color-red)]/30 bg-[var(--color-red)]/10 px-4 py-3">
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-red-bright)]">
            Ahora te toca
          </div>
          <p className="mt-1 text-sm font-medium text-white">{nextStep}</p>
        </div>
      )}

      {(missing.copy || missing.dates) && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3">
          <div className="text-[10px] uppercase tracking-widest text-amber-300">
            Le va a hacer falta esto
          </div>
          <ul className="mt-1.5 space-y-1 text-sm text-zinc-300">
            {missing.copy && (
              <li>
                · La promesa y el avatar.{" "}
                <a
                  href={`/admin/lanzamientos/${launchSlug}?seccion=marca`}
                  className="underline underline-offset-2 hover:text-white"
                >
                  Genéralos en “Marco de copy”
                </a>{" "}
                — son dos clics y salen del brief.
              </li>
            )}
            {missing.dates && (
              <li>
                · Las fechas de cierre.{" "}
                <a
                  href={`/admin/lanzamientos/${launchSlug}?seccion=paginas`}
                  className="underline underline-offset-2 hover:text-white"
                >
                  Ponlas en “Cómo se generan las páginas”
                </a>{" "}
                — la cuenta atrás no puede inventárselas.
              </li>
            )}
          </ul>
        </div>
      )}

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

      {!finished && (
        <div className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-4">
          <div className="text-xs uppercase tracking-widest text-zinc-400">
            Cómo se hace
          </div>
          <ol className="space-y-2 text-sm text-zinc-300">
            <li>
              <strong className="font-semibold text-white">1.</strong> Pulsa el
              botón de arriba. Abre Claude Design con la instrucción y además te
              la deja copiada: si el cuadro de texto sale vacío,{" "}
              <span className="text-zinc-200">pégala y listo</span>.
            </li>
            <li>
              <strong className="font-semibold text-white">2.</strong> Claude te
              propondrá la identidad visual —cuatro colores, dos tipografías y
              el estilo— con una muestra. Dile qué cambiar hasta que te guste y
              luego que la guarde.
            </li>
            <li>
              <strong className="font-semibold text-white">3.</strong> Después
              irá página por página: la diseña, te la enseña y la publica cuando
              le digas.
            </li>
          </ol>

          <CopyPromptButton prompt={queuePrompt} />

          <p className="border-t border-white/5 pt-3 text-xs text-zinc-500">
            No tienes que traer nada de vuelta: Claude escribe directamente aquí
            a través del conector. La identidad aparecerá en el paso 1 del panel
            —con sus colores y tipografías, editables a mano— y cada página
            publicada quedará en su URL, midiendo visitas y capturando leads
            como las demás.
          </p>
        </div>
      )}

      {!finished && (
        <p className="text-xs text-zinc-500">
          La identidad visual va primero: las páginas se diseñan con ella, así
          que hacerlas antes obligaría a repetirlas.
        </p>
      )}
    </div>
  );
}
