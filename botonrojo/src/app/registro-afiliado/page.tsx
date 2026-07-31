import Link from "next/link";
import { registerAffiliateAction } from "@/server/affiliates";
import { SubmitButton } from "@/components/admin/submit-button";

type SearchParams = Promise<{ org?: string }>;

export default async function AffiliateSignupPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;

  if (!sp.org) {
    return (
      <main className="relative mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16 text-center">
        <p className="text-zinc-400">
          Este enlace de registro de afiliados no incluye la organización a la que te unes. Pide a
          quien te lo compartió el enlace completo (con <code>?org=...</code>).
        </p>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <Link href="/" className="text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
        ← Volver
      </Link>

      <div className="glass mt-6 p-8">
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 rounded-full bg-[var(--color-red)] shadow-[0_0_18px_var(--color-red-glow)]" />
          <span className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.2em]">
            Programa de afiliados
          </span>
        </div>

        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-extrabold">
          Conviértete en afiliado
        </h1>
        <p className="mt-2 text-zinc-400">
          Te damos un código <code className="text-[var(--color-red-bright)]">?ref=...</code> propio.
          Cobras comisión por cada venta atribuida a tu enlace. Reportes en tiempo real, pagos
          manuales por lanzamiento.
        </p>

        <form action={registerAffiliateAction} className="mt-8 space-y-4">
          <input type="hidden" name="organizationSlug" value={sp.org} />
          <Field label="Nombre completo" name="name" required minLength={2} />
          <Field label="Email" name="email" type="email" required />
          <Field label="Contraseña (mín. 8 caracteres)" name="password" type="password" required minLength={8} />

          <div className="flex items-center justify-between pt-2">
            <Link href="/login" className="text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
              Ya tengo cuenta →
            </Link>
            <SubmitButton pendingLabel="Creando cuenta…">Quiero ser afiliado</SubmitButton>
          </div>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-zinc-500">
        Comisión por defecto 30% — se ajusta por lanzamiento si procede.
      </p>
    </main>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-widest text-zinc-400">{label}</span>
      <input
        {...rest}
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[var(--color-red)]"
      />
    </label>
  );
}
