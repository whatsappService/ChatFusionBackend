"use strict";
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { gatherRolePermissions } = require("../utils/acl");

/**
 * Verifies JWT and loads a fresh user snapshot.
 * NOTE: We still compute permissions at request-time from the DB user roles
 * (we do not authorize from token claims).
 */
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

    if (!decoded?.id) {
      return res
        .status(401)
        .json({ error: "Unauthorized", code: "invalid_payload" });
    }

    const user = await User.findByPk(decoded.id, {
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

    if (!user)
      return res
        .status(401)
        .json({ error: "Unauthorized", code: "user_not_found" });
    if (user.is_deleted || !user.is_active) {
      return res
        .status(403)
        .json({ error: "AccountDisabled", code: "user_inactive" });
    }

    // Attach to req
    req.user = user;
    req.userId = user.id;
    req.businessId = user.business_id;
    req.authClaims = decoded; // telemetry only

    // Fresh permissions derived from current roles (authoritative)
    const perms = new Set(
      gatherRolePermissions(Array.isArray(user.roles) ? user.roles : [])
    );
    req.permissions = perms;
    req.ctx = {
      userId: user.id,
      businessId: user.business_id,
      roles: Array.isArray(user.roles) ? user.roles : [],
      permissions: perms,
    };

    next();
  } catch (err) {
    console.error("❌ Authentication error:", err);
    return res.status(401).json({ error: "Unauthorized", code: "auth_error" });
  }
};
