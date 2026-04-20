/**
 * Context Server — Entry Point
 */

import express from "express";
import routes from "./routes/index.js";

const PORT = parseInt(process.env.CONTEXT_PORT || "3100", 10);

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS for local development
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Context-Plugin");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Mount API routes
app.use("/api", routes);

// Also mount the public /ctx route at root level for viral propagation URLs
app.use("/", routes);

app.listen(PORT, () => {
  console.log(`[context-server] ✅ Running on http://localhost:${PORT}`);
  console.log(`[context-server] Data dir: ${process.env.CONTEXT_DATA_DIR || "./data"}`);
});
