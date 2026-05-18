import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env } from "@/lib/env";

async function main() {
  console.log(`Connecting to ${env.DATABASE_URL.replace(/:[^:@]+@/, ":****@")}…`);
  const client = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(client);
  console.log("Running migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("✓ Migrations applied.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
