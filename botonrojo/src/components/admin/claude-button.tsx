import Link from "next/link";

/**
 * Botón que abre un chat de Claude con la instrucción puesta.
 *
 * Un enlace normal, sin JavaScript: lo único que hace es abrir una URL.
 *
 * Cuando la cuenta no tiene ningún token del conector, el botón lleva a crearlo en
 * vez de a Claude. Sin token, el chat se abriría con una instrucción que Claude no
 * puede cumplir, y el fallo aparecería lejos de su causa — dentro de Claude, no en
 * el panel donde falta el token.
 */
export function ClaudeButton({
  href,
  label,
  tone = "neutral",
  hasConnector,
  connectorHref = "/admin/conexion-claude",
}: {
  href: string;
  label: string;
  tone?: "neutral" | "primary";
  /** Si la organización tiene algún token activo del conector. */
  hasConnector: boolean;
  connectorHref?: string;
}) {
  if (!hasConnector) {
    return (
      <Link
        href={connectorHref}
        title="Hace falta un token del conector para que Claude pueda trabajar en este lanzamiento"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[11px] uppercase tracking-widest text-amber-300 transition hover:bg-amber-400/20"
      >
        Conectar Claude primero
      </Link>
    );
  }

  const styles =
    tone === "primary"
      ? "border-[var(--color-red)]/40 bg-[var(--color-red)]/10 text-[var(--color-red-bright)] hover:bg-[var(--color-red)]/20"
      : "border-white/15 bg-white/5 text-zinc-200 hover:border-white/40";

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] uppercase tracking-widest transition ${styles}`}
    >
      {label} ↗
    </a>
  );
}
