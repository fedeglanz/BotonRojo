"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/superadmin", label: "Organizaciones" },
  { href: "/superadmin/usuarios", label: "Usuarios" },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-7xl gap-8 px-6 py-8">
      <aside className="hidden w-56 shrink-0 md:block">
        <div className="sticky top-8 space-y-6">
          <Link href="/superadmin" className="flex items-center gap-3">
            <span className="inline-block h-3 w-3 rounded-full bg-amber-500 shadow-[0_0_18px_rgba(245,158,11,0.55)]" />
            <span className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.2em]">
              Super Admin
            </span>
          </Link>
          <nav className="space-y-1">
            {NAV.map((n) => {
              const active = pathname === n.href || (n.href !== "/superadmin" && pathname.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "block rounded-lg px-3 py-2 text-sm transition",
                    active
                      ? "bg-white/5 text-white"
                      : "text-zinc-400 hover:bg-white/[0.03] hover:text-white",
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 pt-4">
            <Link
              href="/admin"
              className="block rounded-lg px-3 py-2 text-sm text-zinc-500 transition hover:bg-white/[0.03] hover:text-white"
            >
              Ir al panel admin →
            </Link>
          </div>
        </div>
      </aside>

      <main className="flex-1 pb-24">{children}</main>
    </div>
  );
}
