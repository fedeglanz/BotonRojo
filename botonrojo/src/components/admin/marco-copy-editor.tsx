"use client";

import { useState } from "react";
import { SubmitButton } from "./submit-button";
import type { AvatarBrief } from "@/db/schema/launches";

type Props = {
  launchId: string;
  avatar: AvatarBrief | null;
  promise: string | null;
  painPoints: string[];
  benefits: string[];
  updateAction: (launchId: string, formData: FormData) => Promise<void>;
};

export function MarcoCopyEditor({ launchId, avatar, promise, painPoints, benefits, updateAction }: Props) {
  const [open, setOpen] = useState(false);
  const hasContent = Boolean(promise);

  if (!hasContent) {
    return (
      <p className="text-sm text-zinc-500">
        Aún no se ha generado el Marco. Pulsa <em>Generar con Claude</em> para crear avatar, promesa,
        dolores y beneficios desde el brief.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <Block label="Promesa">{promise}</Block>

      <div className="grid gap-4 md:grid-cols-2">
        <Block label="Avatar — quién">{avatar?.who ?? "—"}</Block>
        <Block label="Avatar — contexto">{avatar?.context ?? "—"}</Block>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Block label="Puntos de dolor">
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
            {painPoints.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Block>
        <Block label="Beneficios">
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
            {benefits.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Block>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs uppercase tracking-widest text-zinc-400 hover:text-white"
        >
          {open ? "▾ Cerrar editor" : "▸ Editar a mano"}
        </button>

        {open && (
          <form
            action={updateAction.bind(null, launchId)}
            className="mt-4 space-y-4 rounded-lg border border-white/10 bg-black/40 p-5"
          >
            <Field label="Promesa" name="promise" defaultValue={promise ?? ""} />
            <Field label="Avatar — quién" name="avatarWho" defaultValue={avatar?.who ?? ""} />
            <Field label="Avatar — contexto" name="avatarContext" defaultValue={avatar?.context ?? ""} />
            <Textarea label="Puntos de dolor (uno por línea)" name="painPoints" defaultValue={painPoints.join("\n")} rows={6} />
            <Textarea label="Beneficios (uno por línea)" name="benefits" defaultValue={benefits.join("\n")} rows={6} />
            <div className="flex justify-end">
              <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/30 p-4">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-2 text-sm text-zinc-200">{children}</div>
    </div>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-zinc-400">{label}</span>
      <input
        type="text"
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
      />
    </label>
  );
}

function Textarea({ label, name, defaultValue, rows = 4 }: { label: string; name: string; defaultValue: string; rows?: number }) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-zinc-400">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
      />
    </label>
  );
}
