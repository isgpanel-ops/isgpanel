const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

/**
 * Run all SQL files under ./migrations in alphabetical order.
 * Requires: DATABASE_URL env var
 */
async function main() {
  const databaseUrl = (process.env.DATABASE_URL || "").trim();


  if (!databaseUrl) {
    console.error(
      "❌ DATABASE_URL environment variable is missing.\n" +
        "Example:\n" +
        '  DATABASE_URL="postgres://user:pass@host:5432/dbname" node scripts/run-migrations.js\n'
    );
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  const migrationsDir = path.resolve(process.cwd(), "migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ migrations folder not found at: ${migrationsDir}`);
    await pool.end();
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.toLowerCase().endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log("ℹ️ No .sql migration files found in /migrations.");
    await pool.end();
    return;
  }

  console.log("DB:", databaseUrl.replace(/\/\/.*@/, "//***:***@")); // mask creds
  console.log("Migrations dir:", migrationsDir);
  console.log("Migrations:", files);

  try {
    for (const file of files) {
      const fullPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(fullPath, "utf8").trim();

      if (!sql) {
        console.log(`⏭️ Skipping empty migration: ${file}`);
        continue;
      }

      console.log(`\n▶ Running migration: ${file}`);
      await pool.query(sql);
      console.log(`✅ Done: ${file}`);
    }

    console.log("\n🎉 All migrations completed successfully.");
  } catch (err) {
    console.error("\n❌ Migration failed:");
    console.error(err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
