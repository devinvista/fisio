// FLAT LAYOUT — for external hosting (Hostinger/Railway/Render) only.
// In Replit, use artifacts/api-server instead (port 8080 via pnpm --filter @workspace/api-server run dev).
import path from "path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { pool, db } from "../db/index.js";
import app from "./app.js";

const port = Number(process.env.PORT ?? 3001);

async function runMigrations() {
  const migrationsFolder = path.resolve(process.cwd(), "dist/migrations");
  try {
    console.log("Running database migrations...");
    await migrate(db, { migrationsFolder });
    console.log("Migrations complete.");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause = (err as { cause?: { code?: string } })?.cause;
    if (cause?.code === "42P07") {
      console.warn(
        "[migrations] Tables already exist (schema was applied previously). Skipping."
      );
    } else {
      throw err;
    }
  }
}

async function main() {
  await runMigrations();

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  pool.end();
  process.exit(1);
});
