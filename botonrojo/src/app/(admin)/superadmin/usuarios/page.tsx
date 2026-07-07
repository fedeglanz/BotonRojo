import { db } from "@/db";
import { users, organizations } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireSuperAdmin } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function SuperAdminUsersPage() {
  await requireSuperAdmin();

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(organizations, eq(users.organizationId, organizations.id))
    .orderBy(desc(users.createdAt))
    .limit(200);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
          Usuarios
        </h1>
        <p className="mt-2 text-zinc-400">
          Todos los usuarios de la plataforma ({allUsers.length})
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-widest text-zinc-400">
            <tr>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Organización</th>
              <th className="px-4 py-3">Creado</th>
            </tr>
          </thead>
          <tbody>
            {allUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  No hay usuarios.
                </td>
              </tr>
            )}
            {allUsers.map((u) => (
              <tr key={u.id} className="border-t border-white/5 transition hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="text-white">{u.name ?? "—"}</div>
                  <div className="text-xs text-zinc-500">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                      u.role === "superadmin"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : u.role === "admin"
                          ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                          : "border-white/10 bg-white/5 text-zinc-400"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  {u.orgName ? (
                    <span>
                      {u.orgName}{" "}
                      <span className="font-[family-name:var(--font-mono)] text-xs text-zinc-500">
                        ({u.orgSlug})
                      </span>
                    </span>
                  ) : (
                    <span className="text-zinc-500">Sin org</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {u.createdAt.toLocaleDateString("es-ES")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
