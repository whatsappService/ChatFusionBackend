// src/utils/timezone.js
"use strict";

/** Validate an IANA timezone string (e.g., "Asia/Hebron", "America/New_York"). */
function isValidIana(tz) {
  try {
    if (typeof tz !== "string" || !tz.trim()) return false;
    // Will throw if invalid:
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format();
    return true;
  } catch {
    return false;
  }
}

/** Return tz if valid, otherwise the fallback. */
function coerceIana(tz, fallback = "Asia/Hebron") {
  return isValidIana(tz) ? tz : fallback;
}

module.exports = { isValidIana, coerceIana };
