import Link from "next/link";
import { adminCreateAffiliateAction } from "@/server/affiliates";
import { SubmitButton } from "@/components/admin/submit-button";

export default function NuevoAfiliadoPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/admin/afiliados" className="text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
          ← Afiliados
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">Nuevo afiliado</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Crea la cuenta del afiliado y compártele el email y la contraseña inicial. El sistema
          le genera automáticamente un código <code className="text-[var(--color-red-bright)]">?ref=</code>.
        </p>
      </div>

      <form action={adminCreateAffiliateAction} className="glass space-y-5 p-6">
        <Field label="Nombre" name="name" required minLength={2} />
        <Field label="Email" name="email" type="email" required />
        <Field label="Contraseña inicial" name="password" type="password" required minLength={8} />
        <Field
          label="Comisión (%)"
          name="commissionPercent"
          type="number"
          min={0}
          max={100}
          step={1}
          defaultValue={30}
        />

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/afiliados"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 transition hover:text-white"
          >
            Cancelar
          </Link>
          <SubmitButton pendingLabel="Creando…">Crear afiliado</SubmitButton>
        </div>
      </form>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-zinc-400">{label}</span>
      <input
        {...rest}
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[var(--color-red)]"
      />
    </label>
  );
}
