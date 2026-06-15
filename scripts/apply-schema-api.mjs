import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const projectRef = "siazlnqlzqfgdplqrudx";
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!token) {
  console.error("Missing SUPABASE_ACCESS_TOKEN (Personal Access Token from supabase.com/dashboard/account/tokens)");
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "../supabase/schema.sql"), "utf8");

const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});

const body = await res.text();
if (!res.ok) {
  console.error("Migration failed:", res.status, body);
  process.exit(1);
}

console.log("Migration applied:", body);
