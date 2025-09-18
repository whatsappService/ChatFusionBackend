// src/models/business.js
"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class Business extends Model {
  static initScopes() {
    const {
      Feature,
      BusinessFeature,
      BusinessCategory,
      BusinessPackage,
      BusinessPackageFeature,
      BusinessPackagePermission,
    } = this.sequelize.models;

    this.addScope("withFeatures", {
      include: [
        { model: BusinessCategory, as: "category" },
        {
          model: Feature,
          as: "features",
          attributes: ["id", "code", "name", "description"],
          through: {
            model: BusinessFeature,
            attributes: ["enabled", "meta_json", "createdAt", "updatedAt"],
          },
        },
      ],
    });

    this.addScope("withPackages", {
      include: [
        { model: BusinessCategory, as: "category" },
        {
          model: BusinessPackage,
          as: "packages",
          required: false,
          include: [
            {
              model: BusinessPackageFeature,
              as: "featureRules",
              required: false,
              include: [
                {
                  model: Feature,
                  as: "feature",
                  attributes: ["id", "code", "name", "description"],
                },
              ],
            },
            {
              model: BusinessPackagePermission,
              as: "permissions",
              required: false,
              attributes: ["id", "perm", "createdAt", "updatedAt"],
            },
          ],
        },
      ],
    });

    this.addScope("withAll", {
      include: [
        { model: BusinessCategory, as: "category" },
        {
          model: Feature,
          as: "features",
          attributes: ["id", "code", "name", "description"],
          through: {
            model: BusinessFeature,
            attributes: ["enabled", "meta_json", "createdAt", "updatedAt"],
          },
        },
        {
          model: BusinessPackage,
          as: "packages",
          required: false,
          include: [
            {
              model: BusinessPackageFeature,
              as: "featureRules",
              required: false,
              include: [
                {
                  model: Feature,
                  as: "feature",
                  attributes: ["id", "code", "name", "description"],
                },
              ],
            },
            {
              model: BusinessPackagePermission,
              as: "permissions",
              required: false,
              attributes: ["id", "perm", "createdAt", "updatedAt"],
            },
          ],
        },
      ],
    });
  }

  static async findWithFeaturesByPk(id) {
    if (!this._scopes || !this._scopes.withFeatures) this.initScopes();
    return this.scope("withFeatures").findByPk(id);
  }

  static async findWithAllByPk(id) {
    if (!this._scopes || !this._scopes.withAll) this.initScopes();
    return this.scope("withAll").findByPk(id);
  }

  featureMap() {
    const list = (this.get("features") || []).map((f) => ({
      code: f.code,
      enabled: !!(f.BusinessFeature && f.BusinessFeature.enabled),
      meta_json: f.BusinessFeature ? f.BusinessFeature.meta_json : null,
    }));
    return Object.fromEntries(
      list.map((f) => [
        f.code,
        {
          enabled: f.enabled,
          meta_json: f.meta_json,
        },
      ])
    );
  }

  packagesSummary() {
    const pkgs = this.get("packages") || [];
    return pkgs.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      is_system: !!p.is_system,
      is_active: !!p.is_active,
      features: (p.featureRules || []).map((r) => ({
        code: r.feature?.code,
        enabled: !!r.enabled,
        meta_json: r.meta_json ?? null,
      })),
      permissions: (p.permissions || []).map((perm) => perm.perm),
    }));
  }
}

Business.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    business_name: { type: DataTypes.STRING, allowNull: false },
    business_phone_number: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    api_key: { type: DataTypes.STRING, allowNull: true },

    // ✅ fallback only (users can override with their own timezone)
    default_timezone: { type: DataTypes.STRING(64), allowNull: true },

    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    category_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: "Business",
    tableName: "Businesses",
    timestamps: true,
  }
);

module.exports = Business;
