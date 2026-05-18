import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AffiliateShell } from "@/components/affiliate/affiliate-shell";

export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/afiliado");
  if (!["affiliate", "admin"].includes(session.user.role)) redirect("/");

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user?.affiliateCode) redirect("/");

  return <AffiliateShell affiliateCode={user.affiliateCode}>{children}</AffiliateShell>;
}
