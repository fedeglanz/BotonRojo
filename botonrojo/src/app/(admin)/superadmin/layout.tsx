import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SuperAdminShell } from "@/components/admin/superadmin-shell";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/superadmin");
  if (session.user.role !== "superadmin") redirect("/admin");

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
