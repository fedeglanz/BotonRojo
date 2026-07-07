import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role === "affiliate") redirect("/afiliado");
  if (session.user.role !== "admin" && session.user.role !== "superadmin") redirect("/");

  return <AdminShell isSuperAdmin={session.user.role === "superadmin"}>{children}</AdminShell>;
}
