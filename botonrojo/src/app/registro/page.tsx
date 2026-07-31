import Link from "next/link";
import { signUpOrganizationAction } from "@/server/organizations";
import { SubmitButton } from "@/components/admin/submit-button";

export default function SignUpPage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-16">
      <div className="mb-8 flex items-center gap-3">
        <span className="pulse-dot" />
        <span className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.2em]">
          Botón Rojo
        </span>
      </div>

      <div className="glass glow-ring hud-corners w-full p-8">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Crea tu cuenta</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Tu propio espacio para lanzar: lanzamientos, afiliados, dominios y estadísticas aislados
          del resto de clientes.
        </p>

        <form action={signUpOrganizationAction} className="mt-6 space-y-4">
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-zinc-400">Nombre de tu negocio</span>
            <input
              type="text"
              name="organizationName"
              required
              minLength={2}
              placeholder="Ej: Escuela Nómada Digital"
              className="field-input mt-2 w-full px-4 py-3 text-white"
            />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-zinc-400">Tu nombre</span>
            <input
              type="text"
              name="name"
              required
              minLength={2}
              className="field-input mt-2 w-full px-4 py-3 text-white"
            />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-zinc-400">Email</span>
            <input
              type="email"
              name="email"
              required
              className="field-input mt-2 w-full px-4 py-3 text-white"
            />
          </label>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-zinc-400">Contraseña</span>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className="field-input mt-2 w-full px-4 py-3 text-white"
            />
          </label>

          <SubmitButton className="big-red-button w-full" pendingLabel="Creando cuenta…">
            Crear cuenta
          </SubmitButton>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-[var(--color-red-bright)] hover:underline">
            Accede →
          </Link>
        </p>
      </div>
    </main>
  );
}
