"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/afiliado", label: "Dashboard" },
  { href: "/afiliado/enlaces", label: "Mis enlaces" },
  { href: "/afiliado/pagos", label: "Pagos" },
];

export function AffiliateShell({ affiliateCode, children }: { affiliateCode: string; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[2000px] gap-8 px-6 py-8 2xl:px-12">
      <aside className="hidden w-60 shrink-0 md:block">
        <div className="glass sticky top-8 space-y-6 p-4">
          <Link href="/" className="flex items-center gap-3 px-2 pt-1">
            <span className="pulse-dot" />
            <span className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.2em]">
              Botón Rojo
            </span>
          </Link>

          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Tu código</div>
            <div className="mt-1 font-[family-name:var(--font-mono)] text-sm text-[var(--color-red-bright)]">
              ?ref={affiliateCode}
            </div>
          </div>

          <nav className="space-y-1">
            {NAV.map((n) => {
              const active = pathname === n.href || (n.href !== "/afiliado" && pathname.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "relative block rounded-lg px-3 py-2 text-sm transition",
                    active
                      ? "bg-white/[0.06] text-white shadow-[inset_0_0_0_1px_rgba(239,43,61,0.35)]"
                      : "text-zinc-400 hover:bg-white/[0.03] hover:text-white",
                  )}
                >
                  {active && (
                    <span
                      className="absolute -left-4 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[var(--color-red-bright)] shadow-[0_0_10px_var(--color-red-glow)]"
                      aria-hidden
                    />
                  )}
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <form action="/api/auth/signout" method="post" className="pt-4">
            <button className="text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300">
              Salir →
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-24">{children}</main>
    </div>
  );
}
