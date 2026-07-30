import { eq } from "drizzle-orm";
import { db } from "./index";
import { users, organizations } from "./schema";
import { hashPassword } from "@/lib/passwords";
import { createSlug } from "@/lib/ids";

async function main() {
  console.log("Seeding…");

  const orgName = process.env.SEED_ORG_NAME ?? "Escuela Nómada Digital";
  const orgSlug = createSlug(orgName);

  const [org] =
    (await db.select().from(organizations).where(eq(organizations.slug, orgSlug)).limit(1)).length > 0
      ? await db.select().from(organizations).where(eq(organizations.slug, orgSlug)).limit(1)
      : await db.insert(organizations).values({ name: orgName, slug: orgSlug }).returning();

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@botonrojo.local").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "boton-rojo-1234";
  const passwordHash = await hashPassword(adminPassword);

  await db
    .insert(users)
    .values({
      organizationId: org.id,
      email: adminEmail,
      name: "Admin",
      role: "admin",
      isSuperAdmin: true,
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, role: "admin", updatedAt: new Date() },
    });

  console.log(`✓ Organización lista: ${org.name} (${org.slug})`);
  console.log(`✓ Admin user ready: ${adminEmail} / ${adminPassword}`);
  console.log("\nReady. Login at http://localhost:3000/login");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
