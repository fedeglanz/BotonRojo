import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { SubmitButton } from "@/components/admin/submit-button";

type SearchParams = Promise<{ error?: string; callbackUrl?: string }>;

const ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Email o contraseña incorrectos.",
  CallbackRouteError: "Email o contraseña incorrectos (o la base de datos no responde — revisa el log del servidor).",
  Configuration: "Error de configuración del servidor.",
  Default: "No hemos podido iniciarte sesión. Inténtalo de nuevo.",
};

export default async function LoginPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const callbackUrl = sp.callbackUrl ?? "/admin";
  const errorMessage = sp.error ? ERROR_MESSAGES[sp.error] ?? ERROR_MESSAGES.Default : null;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6">
      <div className="mb-8 flex items-center gap-3">
        <span className="pulse-dot" />
        <span className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.2em]">
          Botón Rojo
        </span>
      </div>

      <div className="glass glow-ring hud-corners w-full p-8">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Acceder</h1>
        <p className="mt-1 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.2em] text-zinc-500">
          Panel interno
        </p>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <form
          className="mt-6 space-y-4"
          action={async (formData) => {
            "use server";
            try {
              await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirectTo: callbackUrl,
              });
            } catch (error) {
              if (error instanceof AuthError) {
                redirect(`/login?error=${error.type}`);
              }
              throw error;
            }
          }}
        >
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
              className="field-input mt-2 w-full px-4 py-3 text-white"
            />
          </label>
          <SubmitButton className="w-full" pendingLabel="Entrando…">Entrar</SubmitButton>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          ¿No tienes cuenta?{" "}
          <Link href="/registro-afiliado" className="text-[--color-red-bright] hover:underline">
            Hazte afiliado →
          </Link>
        </p>
      </div>
    </main>
  );
}
