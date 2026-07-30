import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listOrganizations } from "@/server/organizations";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isSuperAdmin) redirect("/admin");

  const orgs = await listOrganizations();

  return (
    <main className="relative mx-auto min-h-screen max-w-4xl px-6 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Plataforma</h1>
      <p className="mt-2 text-zinc-400">Todas las organizaciones registradas en Botón Rojo.</p>

      <div className="glass mt-8 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-zinc-400">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Usuarios</th>
              <th className="px-4 py-3">Creada</th>
            </tr>
          </thead>
          <tbody>
            {orgs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  Sin organizaciones todavía.
                </td>
              </tr>
            )}
            {orgs.map((o) => (
              <tr key={o.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-white">{o.name}</td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-zinc-400">{o.slug}</td>
                <td className="px-4 py-3 text-zinc-300">{o.userCount}</td>
                <td className="px-4 py-3 text-zinc-500">{formatDate(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
