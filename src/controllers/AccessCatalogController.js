"use strict";

const AccessCatalogService = require("../services/AccessCatalogService");

class AccessCatalogController {
  /**
   * GET /api/businesses/:businessId/access-catalog?userId=123
   * Returns:
   * {
   *   features: [{code,name,description}],
   *   permissionsByFeature: { [featureCode]: string[] },
   *   allPermissions: string[],
   *   packages: [{id,name,is_active}],
   *   selected?: {
   *     featureCodes: string[],
   *     permissions: string[],
   *     package: { id, name, is_custom } | null,
   *     package_name: string,
   *     is_custom: boolean
   *   }
   * }
   */
  static async get(req, res, next) {
    try {
      const businessId = Number(req.params.businessId);
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      if (!businessId)
        return res.status(400).json({ error: "InvalidBusinessId" });

      const data = await AccessCatalogService.getAccessCatalog(businessId, {
        userId,
      });
      return res.json(data);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AccessCatalogController;
