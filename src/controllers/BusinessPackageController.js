"use strict";

const BusinessPackageService = require("../services/BusinessPackageService");

class BusinessPackageController {
  static async list(req, res, next) {
    try {
      const { businessId } = req.params;
      const data = await BusinessPackageService.listPackages(
        Number(businessId)
      );
      res.json(data);
    } catch (e) {
      next(e);
    }
  }

  static async get(req, res, next) {
    try {
      const { businessId, packageId } = req.params;
      const data = await BusinessPackageService.getPackage(
        Number(businessId),
        Number(packageId)
      );
      if (!data) return res.status(404).json({ error: "Not found" });
      res.json(data);
    } catch (e) {
      next(e);
    }
  }

  static async create(req, res, next) {
    try {
      const { businessId } = req.params;
      const pkg = await BusinessPackageService.createPackage(
        Number(businessId),
        req.body || {}
      );
      res.status(201).json(pkg);
    } catch (e) {
      next(e);
    }
  }

  static async update(req, res, next) {
    try {
      const { businessId, packageId } = req.params;
      const pkg = await BusinessPackageService.updatePackage(
        Number(businessId),
        Number(packageId),
        req.body || {}
      );
      res.json(pkg);
    } catch (e) {
      next(e);
    }
  }

  static async remove(req, res, next) {
    try {
      const { businessId, packageId } = req.params;
      const out = await BusinessPackageService.deletePackage(
        Number(businessId),
        Number(packageId)
      );
      res.json(out);
    } catch (e) {
      next(e);
    }
  }

  static async assignUser(req, res, next) {
    try {
      const { businessId, packageId, userId } = req.params;
      const out = await BusinessPackageService.assignUserPackage(
        Number(businessId),
        Number(userId),
        Number(packageId)
      );
      res.json(out);
    } catch (e) {
      next(e);
    }
  }

  static async unassignUser(req, res, next) {
    try {
      const { businessId, packageId, userId } = req.params;
      const out = await BusinessPackageService.unassignUserPackage(
        Number(businessId),
        Number(userId),
        Number(packageId)
      );
      res.json(out);
    } catch (e) {
      next(e);
    }
  }

  static async listUserAssignments(req, res, next) {
    try {
      const { businessId, userId } = req.params;
      const data = await BusinessPackageService.listUserAssignments(
        Number(businessId),
        Number(userId)
      );
      res.json(data);
    } catch (e) {
      next(e);
    }
  }

  static async listPackageAssignments(req, res, next) {
    try {
      const { businessId, packageId } = req.params;
      const data = await BusinessPackageService.listPackageAssignments(
        Number(businessId),
        Number(packageId)
      );
      res.json(data);
    } catch (e) {
      next(e);
    }
  }

  static async effectiveAccess(req, res, next) {
    try {
      const { businessId, userId } = req.params;
      const out = await BusinessPackageService.effectiveAccessForUser(
        Number(businessId),
        Number(userId)
      );
      res.json(out);
    } catch (e) {
      next(e);
    }
  }
}

module.exports = BusinessPackageController;
