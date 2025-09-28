// Load env once, with per-env file support
require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "development"}`,
});

const path = require("path");
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
// Default to trusting proxy in development to avoid rate limiting issues
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", process.env.TRUST_PROXY);
} else if (process.env.NODE_ENV === "development") {
  app.set("trust proxy", 1); // Trust first proxy in development
}

// Helmet site-wide. This sets CORP: same-origin by default.
// We'll override CORP to `cross-origin` *only* for /uploads below.
app.use(helmet());

// Optional: keep COEP relaxed if you enabled it elsewhere
// app.use(helmet.crossOriginEmbedderPolicy({ policy: "credentialless" }));

app.use(compression());

/* ---------- Parsers ---------- */
app.use(express.json({ limit: process.env.JSON_LIMIT || "1mb" }));
app.use(
  express.urlencoded({ extended: true, limit: process.env.FORM_LIMIT || "1mb" })
);

/* ---------- CORS ---------- */
// In dev you can allow all by leaving CORS_ORIGINS unset.
// If you set it, it should be a comma-separated list of allowed origins.
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
  : true; // allow all in dev by default
app.use(cors({ origin: corsOrigins, credentials: true }));

/* ---------- Logging ---------- */
app.use(morgan("combined", { stream: winston.stream }));

/* ---------- Static uploads (serves /uploads/...) ---------- */
/**
 * Fix for: net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin
 * Helmet globally sets: Cross-Origin-Resource-Policy: same-origin
 * That blocks <img src="http://localhost:5550/uploads/..."> from a different origin/port (e.g., :5555).
 * Here we override CORP to `cross-origin` for this route and add friendly cache/CORS headers.
 */
const uploadsDir = path.join(process.cwd(), "uploads");

app.use(
  "/uploads",
  // Override CORP for just this route
  helmet.crossOriginResourcePolicy({ policy: "cross-origin" }),
  // Optional: if you want the opener policy relaxed for static too
  // helmet.crossOriginOpenerPolicy({ policy: "same-origin-allow-popups" }),
  express.static(uploadsDir, {
    fallthrough: true,
    maxAge: process.env.UPLOADS_MAX_AGE || "1h",
    // Add helpful headers for static assets
    setHeaders: (res, filePath) => {
      // Keep CORP permissive here as well (in case another middleware set it)
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

      // If you want the files embeddable anywhere, allow all origins for static.
      // (Safe for <img>, <video>, etc.; doesn't grant JS access unless you fetch())
      const staticCorsOrigin = process.env.UPLOADS_CORS_ORIGIN || "*";
      res.setHeader("Access-Control-Allow-Origin", staticCorsOrigin);

      // Basic content security hinting via cache control
      const isImmutable =
        process.env.UPLOADS_IMMUTABLE === "1" ||
        process.env.UPLOADS_IMMUTABLE === "true";
      if (isImmutable) {
        // E.g., when filenames are content-hashed
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else {
        res.setHeader(
          "Cache-Control",
          `public, max-age=${Number(process.env.UPLOADS_CACHE_SECONDS) || 3600}`
        );
      }
    },
  })
);

/* ---------- Rate limiting (toggle with RATE_LIMIT=off) ---------- */
if (process.env.RATE_LIMIT !== "off") {
  app.use(
    rateLimit({
      windowMs: Number(process.env.RATE_WINDOW_MS || 15 * 60 * 1000),
      max: Number(process.env.RATE_MAX || 1000),
      standardHeaders: true,
      legacyHeaders: false,
      // Skip rate limiting for health checks and static files
      skip: (req) => {
        return req.path === "/healthz" || req.path.startsWith("/uploads/");
      },
      // Use a more reliable key generator that doesn't rely on X-Forwarded-For
      keyGenerator: (req) => {
        // Use IP from connection if available, fallback to remote address
        return req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      },
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

  // Log with winston (morgan already logs requests)
  try {
    winston.error(err);
  } catch {
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

/* ---------- Scheduler poller ---------- */
const scheduleService = require("./src/services/scheduleService");
const POLL_MS = Number(process.env.SCHEDULER_POLL_MS || 15000);

setInterval(async () => {
  try {
    const { processed } = await scheduleService.dispatchDueSchedules(25);
    if (processed) {
      console.log(`[scheduler] processed ${processed} due schedule(s)`);
    }
  } catch (e) {
    console.error("[scheduler] error:", e.message);
  }
}, POLL_MS);

/* ---------- Global safety nets ---------- */
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
