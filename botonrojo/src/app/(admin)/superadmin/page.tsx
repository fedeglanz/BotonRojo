import { db } from "@/db";
import { organizations, users, launches } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  await requireSuperAdmin();

  const orgs = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      plan: organizations.plan,
      createdAt: organizations.createdAt,
      userCount: sql<number>`(select count(*) from users where users.organization_id = ${organizations.id})::int`,
      launchCount: sql<number>`(select count(*) from launches where launches.organization_id = ${organizations.id})::int`,
    })
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  const totalUsers = await db.select({ count: sql<number>`count(*)::int` }).from(users);
  const totalOrgs = orgs.length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
          Panel Super Admin
        </h1>
        <p className="mt-2 text-zinc-400">
          Plataforma Botón Rojo — {totalOrgs} organizaciones · {totalUsers[0]?.count ?? 0} usuarios totales
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-widest text-zinc-400">
            <tr>
              <th className="px-4 py-3">Organización</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3 text-right">Usuarios</th>
              <th className="px-4 py-3 text-right">Lanzamientos</th>
              <th className="px-4 py-3">Creada</th>
            </tr>
          </thead>
          <tbody>
            {orgs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No hay organizaciones.
                </td>
              </tr>
            )}
            {orgs.map((org) => (
              <tr key={org.id} className="border-t border-white/5 transition hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-white font-medium">{org.name}</td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-amber-400">
                  {org.slug}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest">
                    {org.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">{org.userCount}</td>
                <td className="px-4 py-3 text-right text-zinc-300">{org.launchCount}</td>
                <td className="px-4 py-3 text-zinc-400">
                  {org.createdAt.toLocaleDateString("es-ES")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
