// src/migrate.ts
import { pool } from "../src/db/pool";
import fs from "fs";
import path from "path";

async function migrate() {
  const sqlPath = path.join(__dirname, "..", "..", "ormconfig.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  try {
    await pool.query(sql);
    console.log("Migrations applied");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed", err);
    process.exit(1);
  }
}

migrate();
