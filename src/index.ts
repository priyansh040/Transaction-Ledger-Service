// src/index.ts
import { createApp } from "./server";
import dotenv from "dotenv";
import { pool } from "./db/pool";
dotenv.config();

const app = createApp();
const port = process.env.PORT || 3000;

async function start() {
  try {
    // simple check
    await pool.query("SELECT 1");
    app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to connect to DB", err);
    process.exit(1);
  }
}

start();
