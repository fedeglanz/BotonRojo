import { db } from "./index";
import { launches, users, organizations } from "./schema";
import { hashPassword } from "@/lib/passwords";
import { eq } from "drizzle-orm";

async function main() {
  console.log("Seeding…");

  // 1. Create default organization
  const orgSlug = process.env.SEED_ORG_SLUG ?? "default";
  const orgName = process.env.SEED_ORG_NAME ?? "Botón Rojo";

  const [org] = await db
    .insert(organizations)
    .values({
      slug: orgSlug,
      name: orgName,
      plan: "pro",
      ownerId: "seed", // updated after admin creation
    })
    .onConflictDoUpdate({
      target: organizations.slug,
      set: { name: orgName, updatedAt: new Date() },
    })
    .returning({ id: organizations.id });

  console.log(`✓ Organization ready: ${orgName} (${org.id})`);

  // 2. Create admin user linked to org
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@botonrojo.local").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "boton-rojo-1234";
  const passwordHash = await hashPassword(adminPassword);

  const [admin] = await db
    .insert(users)
    .values({
      email: adminEmail,
      name: "Admin",
      role: "admin",
      passwordHash,
      organizationId: org.id,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, role: "admin", organizationId: org.id, updatedAt: new Date() },
    })
    .returning({ id: users.id });

  // Update org owner to actual admin user
  await db.update(organizations).set({ ownerId: admin.id }).where(eq(organizations.id, org.id));

  console.log(`✓ Admin user ready: ${adminEmail} / ${adminPassword}`);

  // 3. Sample launches linked to org
  await db
    .insert(launches)
    .values([
      {
        slug: "ejemplo-venta-directa",
        name: "Ejemplo · Venta Directa",
        type: "venta_directa",
        status: "draft",
        organizationId: org.id,
        brief:
          "Evento online de 90 minutos para lanzar el curso de productividad. Cierre con oferta única durante 48h.",
        promise: "Lanza tu evento de venta directa con un solo botón.",
        painPoints: ["No sé por dónde empezar", "Falta tiempo", "No tengo copy"],
        benefits: ["Landing en 5 minutos", "Emails listos", "Tracking integrado"],
        defaultPriceCents: 9700,
      },
      {
        slug: "ejemplo-semilla",
        name: "Ejemplo · Semilla",
        type: "semilla",
        status: "draft",
        organizationId: org.id,
      },
      {
        slug: "ejemplo-plf",
        name: "Ejemplo · PLF",
        type: "plf",
        status: "draft",
        organizationId: org.id,
      },
    ])
    .onConflictDoNothing();

  console.log("✓ Sample launches inserted");

  // 4. Create superadmin (platform owner)
  const superEmail = (process.env.SEED_SUPERADMIN_EMAIL ?? "super@botonrojo.local").toLowerCase();
  const superPassword = process.env.SEED_SUPERADMIN_PASSWORD ?? "super-rojo-1234";
  const superHash = await hashPassword(superPassword);

  await db
    .insert(users)
    .values({
      email: superEmail,
      name: "Super Admin",
      role: "superadmin",
      passwordHash: superHash,
      organizationId: org.id,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash: superHash, role: "superadmin", organizationId: org.id, updatedAt: new Date() },
    });

  console.log(`✓ Superadmin ready: ${superEmail} / ${superPassword}`);

  console.log("\nReady. Login at http://localhost:3000/login");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
