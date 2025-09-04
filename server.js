// Load env once, with per-env file support
require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const winston = require("./src/utils/logger");
const sequelize = require("./src/config/database");
const routes = require("./src/routes");
require("./src/models/associations"); // Ensure associations are loaded

const app = express();

/* ---------- App hardening / platform ---------- */
app.disable("x-powered-by");

// Respect proxies (e.g., if behind Nginx). Use a number or 'loopback'/'uniquelocal' etc.
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);

app.use(helmet());
app.use(compression());

/* ---------- Parsers ---------- */
app.use(express.json({ limit: process.env.JSON_LIMIT || "1mb" }));
app.use(
  express.urlencoded({ extended: true, limit: process.env.FORM_LIMIT || "1mb" })
);

/* ---------- CORS ---------- */
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
  : true; // allow all in dev by default
app.use(cors({ origin: corsOrigins, credentials: true }));

/* ---------- Logging ---------- */
app.use(morgan("combined", { stream: winston.stream }));

/* ---------- Rate limiting (toggle with RATE_LIMIT=off) ---------- */
if (process.env.RATE_LIMIT !== "off") {
  app.use(
    rateLimit({
      windowMs: Number(process.env.RATE_WINDOW_MS || 15 * 60 * 1000),
      max: Number(process.env.RATE_MAX || 1000),
      standardHeaders: true,
      legacyHeaders: false,
    })
  );
}

/* ---------- Health check ---------- */
app.get("/healthz", (_req, res) => res.json({ ok: true }));

/* ---------- Routes ---------- */
app.use("/api", routes);

/* ---------- 404 ---------- */
app.use((req, res) => {
  res.status(404).json({ error: "NotFound" });
});

/* ---------- Error handler ---------- */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const body = {
    error: err.expose ? err.message : "Internal Server Error",
  };

  if (process.env.NODE_ENV !== "production") {
    body.stack = err.stack;
  }

  // Log with winston (morgan already logs requests)
  try {
    winston.error(err);
  } catch {
    // fall back to console if winston stream fails for any reason
    console.error(err);
  }

  res.status(status).json(body);
});

/* ---------- Boot ---------- */
const PORT = Number(process.env.PORT || 5550);
// Avoid schema sync in production unless explicitly requested
const shouldSync =
  (process.env.NODE_ENV !== "production" && process.env.DB_SYNC !== "off") ||
  process.env.DB_SYNC === "on";

(async () => {
  try {
    if (shouldSync) {
      await sequelize.sync();
    } else {
      await sequelize.authenticate();
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Database initialization failed:", err);
    process.exit(1);
  }
})();

/* ---------- Global safety nets ---------- */
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
