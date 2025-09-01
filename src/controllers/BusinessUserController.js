"use strict";

const BusinessPackageService = require("../services/BusinessPackageService");
const BusinessUserService = require("../services/BusinessUserService");

const truthy = (v) => {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
};

exports.list = async (req, res, next) => {
  try {
    const { businessId } = req.params;
    const { q, includeInactive, limit, offset, orderBy, orderDir } =
      req.query || {};

    // Debug once if needed:
    // console.log("Resolved BusinessUserService from:", require.resolve("../api/services/BusinessUserService"));
    // console.log("Exported keys:", Object.keys(BusinessUserService));

    if (typeof BusinessUserService.getAllUsersForBusiness !== "function") {
      throw new Error(
        "BusinessUserService.getAllUsersForBusiness is not available. Check require path and exports."
      );
    }

    const options = {
      q: q || undefined,
      includeInactive: truthy(includeInactive),
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      orderBy,
      orderDir,
    };

    const data = await BusinessUserService.getAllUsersForBusiness(
      Number(businessId),
      options
    );
    return res.json(data);
  } catch (err) {
    console.error("BusinessUserController.list error:", {
      path: req.originalUrl,
      userId: req.user?.id,
      businessId: req.params?.businessId,
      message: err?.message,
      stack: err?.stack,
    });
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const businessId = Number(req.params.businessId);
    const userId = Number(req.params.userId);
    if (!businessId || !userId)
      return res.status(400).json({ error: "BadRequest" });

    const user = await BusinessUserService.getUserForBusiness(
      businessId,
      userId
    );
    if (!user) return res.status(404).json({ error: "NotFound" });
    return res.json(user);
  } catch (err) {
    console.error("BusinessUserController.getOne error:", {
      path: req.originalUrl,
      message: err?.message,
    });
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const businessId = Number(req.params.businessId);
    const userId = Number(req.params.userId);
    if (!businessId || !userId)
      return res.status(400).json({ error: "BadRequest" });

    const patch = req.body || {};
    const updated = await BusinessUserService.updateUserForBusiness(
      businessId,
      userId,
      patch
    );
    if (!updated) return res.status(404).json({ error: "NotFound" });
    return res.json(updated);
  } catch (err) {
    console.error("BusinessUserController.update error:", {
      path: req.originalUrl,
      message: err?.message,
      stack: err?.stack,
    });
    next(err);
  }
};

exports.patch = async (req, res, next) => {
  try {
    const businessId = Number(req.params.businessId);
    const userId = Number(req.params.userId);
    if (!businessId || !userId)
      return res.status(400).json({ error: "BadRequest" });

    const patch = req.body || {};
    const updated = await BusinessUserService.updateUserForBusiness(
      businessId,
      userId,
      patch
    );
    if (!updated) return res.status(404).json({ error: "NotFound" });
    return res.json(updated);
  } catch (err) {
    console.error("BusinessUserController.patch error:", {
      path: req.originalUrl,
      message: err?.message,
    });
    next(err);
  }
};

exports.effectiveAccess = async (req, res, next) => {
  try {
    const businessId = Number(req.params.businessId);
    const userId = Number(req.params.userId);
    if (!businessId || !userId) {
      return res.status(400).json({ error: "BadRequest" });
    }

    const data = await BusinessPackageService.getEffectiveAccessForUser(
      businessId,
      userId
    );
    return res.json(data);
  } catch (err) {
    console.error("BusinessUserController.effectiveAccess error:", {
      path: req.originalUrl,
      message: err?.message,
      stack: err?.stack,
    });
    next(err);
  }
};
