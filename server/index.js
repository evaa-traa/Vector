"use strict";
/**
 * server/index.js — Entry point
 *
 * Responsibilities:
 *   - Load env vars
 *   - Set up Express with middleware (security, logging, rate limiting)
 *   - Mount route modules
 *   - Serve the built frontend SPA
 *   - Start the HTTP server
 *
 * Business logic lives in:
 *   lib/flowise.js        — Flowise streaming & auth
 *   lib/capabilities.js   — Chatflow capability detection
 *   lib/agentTrace.js     — Agent trace parsing
 *   routes/models.js      — GET /models, GET /labs-model
 *   routes/chat.js        — POST /chat, POST /predict
 *   routes/labs.js        — POST /labs-edit, POST /labs-edit-selection
 */

require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const { loadModelsFromEnvDetailed } = require("./models");

const app = express();
app.disable("x-powered-by");

// ── Security & parsing middleware ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      workerSrc: ["'self'", "blob:"]
    }
  }
}));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("tiny"));

// ── Rate limiting on AI endpoints (30 req / min / IP) ────────────────────────
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please wait a moment and try again." }
});
app.use(["/chat", "/predict", "/labs-edit", "/labs-edit-selection"], aiLimiter);

// ── Static frontend (production build) ───────────────────────────────────────
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

// ── Route modules ─────────────────────────────────────────────────────────────
app.use("/", require("./routes/models"));
app.use("/", require("./routes/chat"));
app.use("/", require("./routes/labs"));

// ── SPA catch-all (serves index.html for any unmatched GET) ──────────────────
app.get("*", (req, res, next) => {
  if (fs.existsSync(publicDir)) {
    const indexPath = path.join(publicDir, "index.html");
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  }
  next();
});

// ── Start server ──────────────────────────────────────────────────────────────
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`\n🚀 Server running on http://localhost:${port}`);
  const { models } = loadModelsFromEnvDetailed(process.env);
  if (models.length === 0) {
    console.warn("⚠️  No models configured. Add MODEL_1_NAME / MODEL_1_ID / MODEL_1_HOST to your .env file.");
  } else {
    console.log(`✅ Loaded ${models.length} model(s):`, models.map((m) => m.name).join(", "));
  }
});
