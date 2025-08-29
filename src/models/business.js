// src/models/business.js
"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class Business extends Model {
  static initScopes() {
    const { Feature, BusinessFeature, BusinessCategory } =
      this.sequelize.models;

    this.addScope("withFeatures", {
      include: [
        { model: BusinessCategory, as: "category" },
        {
          model: Feature,
          as: "features",
          attributes: ["id", "code", "name", "description"],
          through: {
            model: BusinessFeature,
            attributes: [
              "enabled",
              "limit_value",
              "meta_json",
              "createdAt",
              "updatedAt",
            ],
          },
        },
      ],
    });
  }

  static async findWithFeaturesByPk(id) {
    if (!this._scopes || !this._scopes.withFeatures) this.initScopes();
    return this.scope("withFeatures").findByPk(id);
  }

  featureMap() {
    const list = (this.get("features") || []).map((f) => ({
      code: f.code,
      enabled: !!(f.BusinessFeature && f.BusinessFeature.enabled),
      limit_value: f.BusinessFeature ? f.BusinessFeature.limit_value : null,
      meta_json: f.BusinessFeature ? f.BusinessFeature.meta_json : null,
    }));
    return Object.fromEntries(
      list.map((f) => [
        f.code,
        {
          enabled: f.enabled,
          limit_value: f.limit_value,
          meta_json: f.meta_json,
        },
      ])
    );
  }
}

Business.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    business_name: { type: DataTypes.STRING, allowNull: false },
    business_phone_number: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    api_key: { type: DataTypes.STRING, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    category_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    modelName: "Business",
    tableName: "Businesses",
    timestamps: true,
  }
);

module.exports = Business;
