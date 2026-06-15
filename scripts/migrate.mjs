import pg from "pg";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

function loadEnvFile() {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), "../.env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = trimmed.slice(0, i);
    const value = trimmed.slice(i + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const projectRef = "siazlnqlzqfgdplqrudx";
const password = process.env.SUPABASE_DB_PASSWORD;

if (!password) {
  console.error(`
Missing SUPABASE_DB_PASSWORD in .env

Get it from Supabase Dashboard → Geshtenja → Project Settings → Database → Database password
Then add to .env:

SUPABASE_DB_PASSWORD=your_password_here

Then run: npm run db:migrate
`);
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../supabase/schema.sql"), "utf8");

const client = new pg.Client({
  host: "aws-0-eu-west-1.pooler.supabase.com",
  port: 6543,
  user: `postgres.${projectRef}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  console.log("Connected to Geshtenja database (eu-west-1)");
  await client.query(sql);
  console.log("Migration applied successfully.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
