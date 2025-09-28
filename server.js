// server.js
// Load env (single source of truth)
require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const winston = require("./src/utils/logger");
const sequelize = require("./src/config/database");
require("./src/models/associations"); // Ensure associations are loaded
const routes = require("./src/routes");

const app = express();

/* ───────────────────────── App hardening / platform ───────────────────────── */
app.disable("x-powered-by");

/**
 * Behind a reverse proxy (Apache/Nginx), you MUST trust the proxy
 * so req.ip is correct and rate limit works reliably.
 * Set TRUST_PROXY to a number (e.g., "1") or "true" for all.
 */
const TRUST_PROXY = process.env.TRUST_PROXY;
if (TRUST_PROXY) {
  // number → trust first N hops, "true" → trust all, "loopback" → local proxies only
  const tp =
    TRUST_PROXY === "true"
      ? true
      : isNaN(Number(TRUST_PROXY))
      ? TRUST_PROXY
      : Number(TRUST_PROXY);
  app.set("trust proxy", tp);
}

/**
 * Helmet defaults are good; we keep CORP: same-origin globally
 * and override only for /uploads below.
 */
app.use(
  helmet({
    // Example: keep default policies; customize if your app needs:
    // contentSecurityPolicy: false, // uncomment if you serve inline scripts etc.
  })
);

// (Optional) If you use COEP/COOP anywhere else, keep them consistent
// app.use(helmet.crossOriginOpenerPolicy({ policy: "same-origin" }));
// app.use(helmet.crossOriginEmbedderPolicy({ policy: "credentialless" }));

app.use(compression());

/* ─────────────────────────────── Parsers ─────────────────────────────── */
app.use(express.json({ limit: process.env.JSON_LIMIT || "1mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.FORM_LIMIT || "1mb",
  })
);

/* ───────────────────────────────── CORS ───────────────────────────────── */
const corsOrigins = (() => {
  const raw = process.env.CORS_ORIGINS; // comma-separated list, or undefined to allow all in dev
  if (!raw) return true; // allow all
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return function originTester(origin, callback) {
    // allow same-origin or no origin (curl/postman)
    if (!origin || list.includes(origin)) return callback(null, true);
    return callback(new Error("CORS: Origin not allowed"), false);
  };
})();
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

/* ─────────────────────────────── Logging ─────────────────────────────── */
app.use(morgan("combined", { stream: winston.stream }));

/* ────────────────────────── Static uploads route ───────────────────────── */
/**
 * Helmet sets CORP: same-origin globally, which blocks <img> from other origins.
 * For /uploads, we intentionally allow cross-origin resource use.
 */
const uploadsDir = path.join(process.cwd(), "uploads");
app.use(
  "/uploads",
  helmet.crossOriginResourcePolicy({ policy: "cross-origin" }),
  express.static(uploadsDir, {
    fallthrough: true,
    maxAge: process.env.UPLOADS_MAX_AGE || "1h",
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      // Embeddable anywhere (images/videos). This doesn't expose JS-access automatically.
      res.setHeader(
        "Access-Control-Allow-Origin",
        process.env.UPLOADS_CORS_ORIGIN || "*"
      );
      const immutable =
        process.env.UPLOADS_IMMUTABLE === "1" ||
        process.env.UPLOADS_IMMUTABLE === "true";
      if (immutable) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        const secs = Number(process.env.UPLOADS_CACHE_SECONDS) || 3600;
        res.setHeader("Cache-Control", `public, max-age=${secs}`);
      }
    },
  })
);

/* ───────────────────────────── Rate limiting ───────────────────────────── */
// Toggle off entirely by setting RATE_LIMIT=off
if (String(process.env.RATE_LIMIT).toLowerCase() !== "off") {
  app.use(
    rateLimit({
      windowMs: Number(process.env.RATE_WINDOW_MS || 15 * 60 * 1000),
      max: Number(process.env.RATE_MAX || 1000),
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) =>
        req.path === "/healthz" || req.path.startsWith("/uploads/"),
      // Works correctly when trust proxy is set
      keyGenerator: (req) => req.ip || req.connection?.remoteAddress || "",
      message: { error: "Too many requests, please try again later." },
    })
  );
}

/* ───────────────────────────── Health check ───────────────────────────── */
app.get("/healthz", (_req, res) => res.json({ ok: true }));

/* ───────────────────────────────── Routes ──────────────────────────────── */
app.use("/api", routes);

/* ──────────────────────────────── 404 ─────────────────────────────────── */
app.use((req, res) => {
  res.status(404).json({ error: "NotFound" });
});

/* ───────────────────────────── Error handler ───────────────────────────── */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  const body = {
    error:
      process.env.NODE_ENV === "production"
        ? err.expose
          ? err.message
          : "Internal Server Error"
        : err.message || "Internal Server Error",
  };
  if (process.env.NODE_ENV !== "production") {
    body.stack = err.stack;
  }
  try {
    winston.error(err);
  } catch {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(status).json(body);
});

/* ───────────────────────────────── Boot ───────────────────────────────── */
const PORT = Number(process.env.PORT || 5550);
const HOST = process.env.HOST || "0.0.0.0"; // Docker-friendly

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

    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
    });
  } catch (err) {
    console.error("Database initialization failed:", err);
    process.exit(1);
  }
})();

/* ───────────────────────────── Scheduler poller ─────────────────────────── */
const scheduleService = require("./src/services/scheduleService");
const POLL_MS = Number(process.env.SCHEDULER_POLL_MS || 15000);

const poller = setInterval(async () => {
  try {
    const { processed } = await scheduleService.dispatchDueSchedules(25);
    if (processed)
      console.log(`[scheduler] processed ${processed} due schedule(s)`);
  } catch (e) {
    console.error("[scheduler] error:", e.message);
  }
}, POLL_MS);

/* ────────────────────────────── Safety nets ─────────────────────────────── */
const shutdown = (signal) => async () => {
  try {
    console.log(`${signal} received, shutting down...`);
    clearInterval(poller);
    await sequelize.close().catch(() => {});
    process.exit(0);
  } catch {
    process.exit(1);
  }
};
process.on("SIGINT", shutdown("SIGINT"));
process.on("SIGTERM", shutdown("SIGTERM"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
