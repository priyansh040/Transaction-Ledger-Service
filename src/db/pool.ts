// src/db/pool.ts
import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://ledger:ledgerpass@localhost:5432/ledger";

export const pool = new Pool({
  connectionString,
});
