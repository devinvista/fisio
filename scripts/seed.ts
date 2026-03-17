import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../db/schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function seed() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("demo123", 10);

  await db
    .insert(schema.usersTable)
    .values({
      name: "Demo Usuário",
      email: "demo@fisiogest.com",
      passwordHash,
      role: "admin",
    })
    .onConflictDoNothing();

  console.log("✓ Demo user created: demo@fisiogest.com / demo123");
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
