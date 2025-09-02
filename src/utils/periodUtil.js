// src/utils/periodUtil.js
"use strict";

const PERIOD = {
  DAY: "day",
  WEEK: "week",
  MONTH: "month",
  YEAR: "year",
};

function normalizePeriod(p) {
  const s = String(p || "").toLowerCase();
  if (s === "year" || s === "yearly" || s === "annual" || s === "annually") {
    return PERIOD.YEAR;
  }
  if (s === "month" || s === "monthly") return PERIOD.MONTH;
  if (s === "week" || s === "weekly") return PERIOD.WEEK;
  return PERIOD.DAY;
}

function periodKey(period, when = new Date()) {
  const d = new Date(when);
  const pad = (n) => String(n).padStart(2, "0");
  switch ((period || "DAY").toUpperCase()) {
    case "DAY":
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
        d.getUTCDate()
      )}`;
    case "WEEK": {
      // ISO week
      const date = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
      );
      const dayNum = (date.getUTCDay() + 6) % 7;
      date.setUTCDate(date.getUTCDate() - dayNum + 3);
      const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
      const week =
        1 +
        Math.round(
          ((date - firstThursday) / 86400000 -
            3 +
            ((firstThursday.getUTCDay() + 6) % 7)) /
            7
        );
      return `${date.getUTCFullYear()}-W${pad(week)}`;
    }
    case "MONTH":
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
    case "YEAR":
      return `${d.getUTCFullYear()}`;
    default:
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
        d.getUTCDate()
      )}`;
  }
}

module.exports = { PERIOD, normalizePeriod, periodKey };
