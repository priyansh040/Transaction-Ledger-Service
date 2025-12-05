// src/server.ts
import express from "express";
import bodyParser from "body-parser";
import routes from "./routes";

export function createApp() {
  const app = express();
  app.use(bodyParser.json());
  app.use(routes);
  app.get("/health", (req, res) => res.json({ status: "ok" }));
  return app;
}
