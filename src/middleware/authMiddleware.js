"use strict";
const jwt = require("jsonwebtoken");
const User = require("../models/user");

module.exports = async function authenticateUser(req, res, next) {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("✖ JWT_SECRET is not set");
      return res.status(500).json({ error: "ServerMisconfigured" });
    }

    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized", code: "no_token" });
    }
    const token = authHeader.split(" ")[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS256"],
        clockTolerance: 5,
        // issuer: process.env.JWT_ISSUER || "muraasla", // enable only if all tokens include iss
      });
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res
          .status(401)
          .json({ error: "Unauthorized", code: "token_expired" });
      }
      if (err.name === "NotBeforeError") {
        return res
          .status(401)
          .json({ error: "Unauthorized", code: "token_not_yet_valid" });
      }
      return res
        .status(401)
        .json({ error: "Unauthorized", code: "invalid_token" });
    }

    const userId = decoded?.id ?? decoded?.sub; // 👈 accept sub fallback
    if (!userId) {
      return res
        .status(401)
        .json({ error: "Unauthorized", code: "invalid_payload" });
    }

    const user = await User.findByPk(userId, {
      attributes: [
        "id",
        "business_id",
        "full_name",
        "email_address",
        "phone_number",
        "roles",
        "is_active",
        "is_deleted",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!user) {
      return res
        .status(401)
        .json({ error: "Unauthorized", code: "user_not_found" });
    }
    if (user.is_deleted || !user.is_active) {
      return res
        .status(403)
        .json({ error: "AccountDisabled", code: "user_inactive" });
    }

    req.user = user;
    req.userId = user.id;
    req.businessId = user.business_id;
    req.authClaims = decoded;
    req.ctx = {
      userId: user.id,
      businessId: user.business_id,
      roles: Array.isArray(user.roles) ? user.roles : [],
    };

    next();
  } catch (err) {
    console.error("❌ Authentication error:", err);
    return res.status(401).json({ error: "Unauthorized", code: "auth_error" });
  }
};
