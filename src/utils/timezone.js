"use strict";

const { DateTime } = require("luxon"); // optional but nice; otherwise use Intl

// Very small IANA validator (cheap check)
const IANA_RE = /^[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?$/;

exports.isValidIana = (tz) => typeof tz === "string" && IANA_RE.test(tz);

// Format Date -> ISO string in a specific tz (local wall clock)
exports.toLocalISO = (date, tz) => {
  try {
    if (!exports.isValidIana(tz)) return null;
    return DateTime.fromJSDate(date, { zone: "utc" })
      .setZone(tz)
      .toISO({ suppressMilliseconds: true });
  } catch {
    return null;
  }
};

// Convert local “wall clock” ISO (e.g., 2025-09-06T10:30) in tz -> UTC Date
exports.toUtcFromLocalISO = (localIso, tz) => {
  try {
    if (!exports.isValidIana(tz)) return null;
    const dt = DateTime.fromISO(localIso, { zone: tz });
    if (!dt.isValid) return null;
    return dt.toUTC().toJSDate();
  } catch {
    return null;
  }
};

/**
 * Decide the best timezone for this request:
 * 1) explicit param/header
 * 2) user.timezone
 * 3) business.default_timezone
 * 4) SERVER_DEFAULT_TZ or "Asia/Hebron"
 */
exports.pickTimezone = (req) => {
  const fromQuery = req.query?.timezone;
  const fromBody = req.body?.timezone;
  const fromHdr = req.get("x-timezone") || req.get("X-User-Timezone");

  const userTz = req.user?.timezone;
  const bizTz = req.user?.business?.default_timezone; // if auth middleware stuffed business on req.user

  const fallback = process.env.SERVER_DEFAULT_TZ || "Asia/Hebron";

  const firstValid = [
    fromQuery,
    fromBody,
    fromHdr,
    userTz,
    bizTz,
    fallback,
  ].find((tz) => exports.isValidIana(tz));

  return firstValid || fallback;
};
