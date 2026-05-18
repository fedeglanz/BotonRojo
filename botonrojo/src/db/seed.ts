import { db } from "./index";
import { launches, users } from "./schema";
import { hashPassword } from "@/lib/passwords";

async function main() {
  console.log("Seeding…");

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@botonrojo.local").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "boton-rojo-1234";
  const passwordHash = await hashPassword(adminPassword);

  await db
    .insert(users)
    .values({
      email: adminEmail,
      name: "Admin",
      role: "admin",
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { passwordHash, role: "admin", updatedAt: new Date() },
    });

  console.log(`✓ Admin user ready: ${adminEmail} / ${adminPassword}`);

  await db
    .insert(launches)
    .values([
      {
        slug: "ejemplo-venta-directa",
        name: "Ejemplo · Venta Directa",
        type: "venta_directa",
        status: "draft",
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
      },
      {
        slug: "ejemplo-plf",
        name: "Ejemplo · PLF",
        type: "plf",
        status: "draft",
      },
    ])
    .onConflictDoNothing();

  console.log("✓ Sample launches inserted");
  console.log("\nReady. Login at http://localhost:3000/login");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
