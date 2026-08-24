"use client";

import { useState } from "react";
import { SubmitButton } from "./submit-button";

/**
 * Archivar o borrar el lanzamiento.
 *
 * Son dos cosas distintas y por eso están las dos:
 *
 * · **Archivar** lo saca de la galaxia y no pierde nada. Es lo que se quiere con un
 *   lanzamiento que ya pasó o que se aparcó — sus números siguen ahí.
 * · **Borrar** solo aparece cuando no hay nada hecho. Un lanzamiento vacío es un
 *   error de hace dos minutos —un nombre mal escrito, uno duplicado por pulsar dos
 *   veces— y archivarlo sería guardar basura para siempre. Uno con una sola visita
 *   registrada ya es historia, y esa no se tira.
 *
 * Borrar pide confirmación escribiendo el nombre. Un `confirm()` del navegador se
 * acepta por reflejo; escribir el nombre obliga a leer qué se está borrando.
 */
export function LaunchDangerZone({
  launchName,
  archiveAction,
  deleteAction,
  puedeBorrarse,
  huella,
}: {
  launchName: string;
  archiveAction: () => Promise<void>;
  deleteAction: () => Promise<void>;
  puedeBorrarse: boolean;
  /** Qué hay dentro, para explicar por qué no se puede borrar. */
  huella: {
    paginas: number;
    productos: number;
    eventos: number;
    pedidos: number;
  };
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");

  const dentro = [
    huella.paginas && `${huella.paginas} página${huella.paginas === 1 ? "" : "s"}`,
    huella.productos &&
      `${huella.productos} producto${huella.productos === 1 ? "" : "s"}`,
    huella.eventos &&
      `${huella.eventos} visita${huella.eventos === 1 ? "" : "s"} o registro${huella.eventos === 1 ? "" : "s"}`,
    huella.pedidos && `${huella.pedidos} pedido${huella.pedidos === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mt-10 rounded-xl border border-white/10 bg-black/20 p-5">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">
        Archivar o borrar
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-xl text-sm text-zinc-400">
          Archivar lo saca de la galaxia y no pierde nada: puedes recuperarlo cuando
          quieras.{" "}
          {puedeBorrarse
            ? "Y como todavía no tiene nada dentro, también se puede borrar del todo."
            : `Borrarlo ya no: tiene ${dentro} y eso no se tira.`}
        </p>
        <form action={archiveAction}>
          <SubmitButton variant="ghost" pendingLabel="Archivando…">
            Archivar
          </SubmitButton>
        </form>
      </div>

      {puedeBorrarse && (
        <div className="mt-4 border-t border-white/10 pt-4">
          {!abierto ? (
            <button
              type="button"
              onClick={() => setAbierto(true)}
              className="text-xs uppercase tracking-widest text-red-400/80 underline-offset-4 transition hover:text-red-300 hover:underline"
            >
              Borrarlo para siempre
            </button>
          ) : (
            <form action={deleteAction} className="space-y-3">
              <p className="text-sm text-zinc-300">
                Esto no se puede deshacer. Escribe{" "}
                <span className="font-medium text-white">{launchName}</span> para
                confirmar.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="El nombre del lanzamiento"
                  className="field-input min-w-64 px-3 py-2 text-sm text-white"
                />
                <SubmitButton
                  variant="ghost"
                  pendingLabel="Borrando…"
                  disabled={nombre.trim() !== launchName.trim()}
                >
                  Borrar
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => {
                    setAbierto(false);
                    setNombre("");
                  }}
                  className="text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
