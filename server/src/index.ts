/**
 * Context Server — Entry Point v1.5
 */

import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { initDb } from "./db.js";
import routes from "./routes/index.js";

const PORT = parseInt(process.env.PORT || process.env.CONTEXT_PORT || "3100", 10);
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = process.env.CONTEXT_DATA_DIR || path.join(process.cwd(), "data");

// Token auth: if CONTEXT_TOKEN env is set, require it for API access
// Token can also be auto-generated and saved to data/token.txt
let AUTH_TOKEN: string | null = process.env.CONTEXT_TOKEN || null;

if (!AUTH_TOKEN) {
  const tokenPath = path.join(DATA_DIR, "token.txt");
  if (fs.existsSync(tokenPath)) {
    AUTH_TOKEN = fs.readFileSync(tokenPath, "utf-8").trim();
  }
}

// Print token info
if (AUTH_TOKEN) {
  console.log(`[context-server] 🔒 Token auth enabled (token: ${AUTH_TOKEN.slice(0, 8)}...)`);
} else {
  console.log(`[context-server] ⚠️  No auth token set. API is open. Set CONTEXT_TOKEN env or create data/token.txt`);
}

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Context-Plugin, Authorization, X-Context-Token");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Auth middleware for /api routes
function apiAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!AUTH_TOKEN) return next(); // No token = open access

  // Check multiple auth methods
  const token =
    req.headers["x-context-token"] as string ||
    req.headers["authorization"]?.replace("Bearer ", "") ||
    req.query.token as string;

  if (token === AUTH_TOKEN) return next();

  // Allow X-Context-Plugin header (from OpenClaw gateway, already authenticated)
  if (req.headers["x-context-plugin"] === "true") return next();

  res.status(401).json({ error: "Unauthorized. Provide token via X-Context-Token header, Authorization: Bearer, or ?token= query." });
}

// Web UI routes — no auth required (browser session)
// In production, add session/cookie auth here
app.use("/s", routes);

// API routes — token auth
app.use("/api", apiAuth, routes);

// /ctx routes — public (content + install hint for non-plugin agents, or rendered page for browsers)
app.use("/", routes);

// Initialize database then start server
initDb().then(() => {
  app.listen(PORT, HOST, () => {
    console.log(`[context-server] ✅ Running on http://${HOST}:${PORT}`);
    console.log(`[context-server] DB: ${process.env.TURSO_DATABASE_URL || "file:./data/context.db"}`);
  });
}).catch((err) => {
  console.error(`[context-server] ❌ Database init failed:`, err);
  process.exit(1);
});
