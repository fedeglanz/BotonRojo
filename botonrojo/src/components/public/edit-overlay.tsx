"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { SubmitButton } from "@/components/admin/submit-button";
import type { EditContext, EditTarget } from "./edit-mode";

/**
 * In-page editing.
 *
 * Half the design problems in this project were problems of translation: the
 * client saw something wrong, described it in words, and then someone had to work
 * out which section and which field that meant. Pointing at the thing removes that
 * step, so the edit box is anchored to whatever you clicked.
 *
 * The chrome is deliberately kept out of the page's own markup: an outline on
 * hover and a floating panel, nothing that shifts the layout, so what you're
 * editing still looks exactly like what visitors get.
 */

type Selection = {
  target: EditTarget;
  label: string;
  /** Set when adding: the band the new section goes under. */
  after?: EditTarget;
} | null;

type EditState = {
  ctx: EditContext;
  selection: Selection;
  select: (selection: Selection) => void;
  /** Reordering lives on the region itself, not in the panel: moving a band is a
   *  one-click action and opening a side panel for it would be in the way. */
  moveBlockAction: (formData: FormData) => Promise<void>;
  /** How many blocks the page has, so the arrows can be hidden at the ends. */
  blockCount: number;
};

const EditModeContext = createContext<EditState | null>(null);

export function useEditMode() {
  return useContext(EditModeContext);
}

export function EditModeProvider({
  ctx,
  children,
  refineAction,
  designAction,
  addBlockAction,
  removeBlockAction,
  moveBlockAction,
  blockCount = 0,
}: {
  ctx: EditContext;
  children: React.ReactNode;
  blockCount?: number;
  refineAction: (formData: FormData) => Promise<void>;
  designAction: (formData: FormData) => Promise<void>;
  addBlockAction: (formData: FormData) => Promise<void>;
  removeBlockAction: (formData: FormData) => Promise<void>;
  moveBlockAction: (formData: FormData) => Promise<void>;
}) {
  const [selection, select] = useState<Selection>(null);

  // Escape closes the panel — the usual way out of a modal-ish thing.
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection]);

  if (!ctx.enabled) return <>{children}</>;

  return (
    <EditModeContext.Provider
      value={{ ctx, selection, select, moveBlockAction, blockCount }}
    >
      {children}
      <EditBar ctx={ctx} />
      {selection && (
        <EditPanel
          ctx={ctx}
          selection={selection}
          onClose={() => select(null)}
          refineAction={refineAction}
          designAction={designAction}
          addBlockAction={addBlockAction}
          removeBlockAction={removeBlockAction}
        />
      )}
    </EditModeContext.Provider>
  );
}

/** Always-visible reminder that this render is not what a visitor sees. */
function EditBar({ ctx }: { ctx: EditContext }) {
  return (
    <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-full border border-white/15 bg-black/85 px-4 py-2 text-xs text-white shadow-lg backdrop-blur">
      <span className="font-semibold">Modo edición</span>
      <span className="mx-2 text-white/40">·</span>
      <span className="text-white/70">
        Pasa el ratón por una sección y pulsa para cambiarla
      </span>
      <a
        href={`/admin/lanzamientos/${ctx.launchSlug}/paginas/${ctx.pageKey}`}
        className="ml-3 underline underline-offset-2 hover:text-white"
      >
        Ir al panel
      </a>
      <a
        href="?"
        className="ml-3 text-white/60 underline underline-offset-2 hover:text-white"
      >
        Salir
      </a>
    </div>
  );
}

/**
 * Wraps one band or block so it can be pointed at. Renders a relatively
 * positioned container plus an absolutely positioned outline, so nothing in the
 * page's own layout moves when edit mode is on.
 */
export function Editable({
  target,
  label,
  children,
}: {
  target: EditTarget;
  label: string;
  children: React.ReactNode;
}) {
  const edit = useEditMode();
  const [hover, setHover] = useState(false);

  if (!edit?.ctx.enabled) return <>{children}</>;

  const selected =
    edit.selection?.target.kind === target.kind &&
    JSON.stringify(edit.selection.target) === JSON.stringify(target);

  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}

      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 z-40 rounded-lg transition ${
          selected
            ? "ring-2 ring-[var(--color-accent)]"
            : hover
              ? "ring-2 ring-[var(--color-accent)]/50"
              : "ring-0"
        }`}
      />

      {(hover || selected) && (
        <div className="absolute right-3 top-3 z-50 flex gap-2">
          <button
            type="button"
            onClick={() => edit.select({ target, label })}
            className="rounded-md bg-black/85 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur hover:bg-black"
          >
            Cambiar {label}
          </button>
          <button
            type="button"
            onClick={() =>
              edit.select({
                target: { kind: "block", index: -1 },
                label: `debajo de ${label}`,
                after: target,
              })
            }
            className="rounded-md bg-black/85 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur hover:bg-black"
            title="Añadir una sección nueva debajo de esta"
          >
            + sección
          </button>

          {target.kind === "block" && (
            <>
              {target.index > 0 && (
                <MoveButton
                  edit={edit}
                  target={target}
                  direction="up"
                  label="Subir esta sección"
                >
                  ↑
                </MoveButton>
              )}
              {target.index < edit.blockCount - 1 && (
                <MoveButton
                  edit={edit}
                  target={target}
                  direction="down"
                  label="Bajar esta sección"
                >
                  ↓
                </MoveButton>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** One arrow. A tiny form rather than a fetch, so it goes through the same server
 *  action and revalidation path as every other edit. */
function MoveButton({
  edit,
  target,
  direction,
  label,
  children,
}: {
  edit: EditState;
  target: EditTarget;
  direction: "up" | "down";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <form action={edit.moveBlockAction}>
      <input type="hidden" name="launchId" value={edit.ctx.launchId} />
      <input type="hidden" name="pageKey" value={edit.ctx.pageKey} />
      <input type="hidden" name="target" value={JSON.stringify(target)} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        title={label}
        aria-label={label}
        className="rounded-md bg-black/85 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur hover:bg-black"
      >
        {children}
      </button>
    </form>
  );
}

const BACKGROUNDS = [
  ["", "Sin cambiar"],
  ["none", "Sin fondo"],
  ["tint", "Tinte suave"],
  ["accent", "Tinte fuerte"],
  ["dark", "Banda oscura"],
  ["photo", "Foto de fondo"],
] as const;

const EFFECTS = [
  ["", "Sin cambiar"],
  ["none", "Ninguno"],
  ["aurora", "Resplandor en movimiento"],
  ["geometry", "Geometría grande"],
  ["grid", "Retícula técnica"],
  ["dots", "Retícula de puntos"],
  ["noise", "Grano"],
  ["orbit", "Círculo girando"],
] as const;

const BLOCK_TYPES = [
  ["benefits", "Beneficios con iconos"],
  ["imageText", "Imagen + texto + botón"],
  ["steps", "Pasos numerados"],
  ["faq", "Preguntas frecuentes"],
  ["testimonials", "Testimonios"],
  ["cta", "Llamada a la acción"],
] as const;

function EditPanel({
  ctx,
  selection,
  onClose,
  refineAction,
  designAction,
  addBlockAction,
  removeBlockAction,
}: {
  ctx: EditContext;
  selection: NonNullable<Selection>;
  onClose: () => void;
  refineAction: (formData: FormData) => Promise<void>;
  designAction: (formData: FormData) => Promise<void>;
  addBlockAction: (formData: FormData) => Promise<void>;
  removeBlockAction: (formData: FormData) => Promise<void>;
}) {
  const router = useRouter();
  const isNew =
    selection.target.kind === "block" && selection.target.index === -1;
  const [tab, setTab] = useState<"copy" | "design">(isNew ? "design" : "copy");

  // The actions revalidate on the server; refreshing pulls the new render in
  // without a full reload, so you keep your place on the page.
  const after = () => {
    onClose();
    router.refresh();
  };

  const targetJson = JSON.stringify(selection.target);

  return (
    <aside className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l border-white/10 bg-[#0b0b0d] text-white shadow-2xl">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500">
            {isNew ? "Añadir sección" : "Editando"}
          </div>
          <div className="font-[family-name:var(--font-display)] font-bold">
            {selection.label}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-300 hover:border-white/40"
        >
          Cerrar
        </button>
      </header>

      {isNew ? (
        <form
          action={addBlockAction}
          onSubmit={after}
          className="space-y-4 overflow-y-auto p-5"
        >
          <input type="hidden" name="launchId" value={ctx.launchId} />
          <input type="hidden" name="pageKey" value={ctx.pageKey} />
          <input type="hidden" name="target" value={targetJson} />
          {/* Where to insert: the band that was pointed at, so the new section
              lands under it instead of at the end of the page. */}
          <input
            type="hidden"
            name="after"
            value={JSON.stringify(selection.after ?? null)}
          />

          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-zinc-400">
              Qué sección
            </span>
            <select
              name="blockType"
              className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
              defaultValue="benefits"
            >
              {BLOCK_TYPES.map(([value, label]) => (
                <option key={value} value={value} className="bg-zinc-900">
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-zinc-400">
              Qué quieres que diga
            </span>
            <textarea
              name="instruction"
              rows={4}
              required
              placeholder="Tres ventajas de hacerlo con Factucheck frente a seguir en Excel, con iconos."
              className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              Se escribe con el marco de copy del lanzamiento y el sistema de
              diseño aprobado.
            </span>
          </label>

          <SubmitButton pendingLabel="Creando la sección…">
            Añadir aquí
          </SubmitButton>
        </form>
      ) : (
        <>
          <div className="flex gap-1 border-b border-white/10 px-5 pt-3">
            {(["copy", "design"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-t-md px-3 py-2 text-sm ${
                  tab === t
                    ? "bg-white/10 text-white"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t === "copy" ? "Texto" : "Diseño"}
              </button>
            ))}
          </div>

          {tab === "copy" ? (
            <form
              action={refineAction}
              onSubmit={after}
              className="space-y-4 overflow-y-auto p-5"
            >
              <input type="hidden" name="launchId" value={ctx.launchId} />
              <input type="hidden" name="pageKey" value={ctx.pageKey} />
              <input type="hidden" name="target" value={targetJson} />

              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-zinc-400">
                  Qué cambiar del texto
                </span>
                <textarea
                  name="instruction"
                  rows={5}
                  required
                  placeholder="Más corto y directo, y que hable de la multa concreta en vez de 'sanciones'."
                  className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
                />
              </label>

              <SubmitButton pendingLabel="Reescribiendo…">
                Reescribir esta parte
              </SubmitButton>
            </form>
          ) : (
            <form
              action={designAction}
              onSubmit={after}
              className="space-y-4 overflow-y-auto p-5"
            >
              <input type="hidden" name="launchId" value={ctx.launchId} />
              <input type="hidden" name="pageKey" value={ctx.pageKey} />
              <input type="hidden" name="target" value={targetJson} />

              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-zinc-400">
                  Fondo
                </span>
                <select
                  name="background"
                  className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
                >
                  {BACKGROUNDS.map(([value, label]) => (
                    <option key={value} value={value} className="bg-zinc-900">
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="block text-xs uppercase tracking-widest text-zinc-400">
                  Efecto
                </span>
                <select
                  name="effect"
                  className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
                >
                  {EFFECTS.map(([value, label]) => (
                    <option key={value} value={value} className="bg-zinc-900">
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs uppercase tracking-widest text-zinc-400">
                    Altura
                  </span>
                  <select
                    name="height"
                    className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
                  >
                    <option value="" className="bg-zinc-900">
                      Sin cambiar
                    </option>
                    <option value="auto" className="bg-zinc-900">
                      Normal
                    </option>
                    <option value="full" className="bg-zinc-900">
                      Pantalla completa
                    </option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-xs uppercase tracking-widest text-zinc-400">
                    Ancho
                  </span>
                  <select
                    name="width"
                    className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
                  >
                    <option value="" className="bg-zinc-900">
                      Sin cambiar
                    </option>
                    <option value="normal" className="bg-zinc-900">
                      Normal
                    </option>
                    <option value="wide" className="bg-zinc-900">
                      Amplio
                    </option>
                    <option value="full" className="bg-zinc-900">
                      A sangre
                    </option>
                  </select>
                </label>
              </div>

              <p className="text-xs text-zinc-500">
                Lo que no encaje con este tipo de sección se ajusta solo — una
                órbita no cabe alrededor de un párrafo largo, por ejemplo.
              </p>

              <SubmitButton pendingLabel="Aplicando…">
                Aplicar el diseño
              </SubmitButton>
            </form>
          )}

          {tab === "design" && selection.target.kind === "block" && (
            <form
              action={removeBlockAction}
              onSubmit={after}
              className="border-t border-white/10 p-5"
            >
              <input type="hidden" name="launchId" value={ctx.launchId} />
              <input type="hidden" name="pageKey" value={ctx.pageKey} />
              <input type="hidden" name="target" value={targetJson} />
              <SubmitButton variant="danger" pendingLabel="Quitando…">
                Quitar esta sección
              </SubmitButton>
            </form>
          )}
        </>
      )}
    </aside>
  );
}
