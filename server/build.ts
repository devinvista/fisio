import path from "path";
import { fileURLToPath } from "url";
import { build as esbuild } from "esbuild";
import { readFile, cp, mkdir } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");

const allowlist = [
  "bcryptjs",
  "cors",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "jsonwebtoken",
  "pg",
  "zod",
];

async function buildAll() {
  const distDir = path.resolve(rootDir, "dist");

  console.log("Building server...");
  const pkgPath = path.resolve(rootDir, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: [path.resolve(rootDir, "server/index.ts")],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: path.resolve(distDir, "server.cjs"),
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  console.log("Copying migration files...");
  const migrationsSource = path.resolve(rootDir, "db/migrations");
  const migrationsDest = path.resolve(distDir, "migrations");
  await mkdir(migrationsDest, { recursive: true });
  await cp(migrationsSource, migrationsDest, { recursive: true });

  console.log("Build complete: dist/server.cjs + dist/migrations/");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
