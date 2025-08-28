"use strict";
const { Model, DataTypes } = require("sequelize");
const sequelize = require("../config/database");

class Business extends Model {
  static associate(models) {
    // Category
    Business.belongsTo(models.BusinessCategory, {
      as: "category",
      foreignKey: "category_id",
    });

    // Optional: users under this business
    if (models.User) {
      Business.hasMany(models.User, {
        as: "users",
        foreignKey: "business_id",
      });
    }

    // Feature toggles at business level
    Business.hasMany(models.BusinessFeature, {
      as: "featureToggles",
      foreignKey: "business_id",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    // Many-to-many: Business ↔ Feature through BusinessFeature
    Business.belongsToMany(models.Feature, {
      as: "features",
      through: models.BusinessFeature,
      foreignKey: "business_id",
      otherKey: "feature_id",
    });
  }

  // Handy scope to include features + the through attributes
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

  // Convenience method to fetch a business with features in one call
  static async findWithFeaturesByPk(id) {
    // ensure scope is available even if associate loader runs once
    if (!this._scopes || !this._scopes.withFeatures) this.initScopes();
    return this.scope("withFeatures").findByPk(id);
  }

  // Build a quick { code: { enabled, limit_value, meta_json } } map from joined rows
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

// IMPORTANT: call initScopes after all models are registered
// (Do this in your associations loader after `associate` calls)
module.exports = Business;
