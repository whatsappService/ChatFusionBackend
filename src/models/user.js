"use strict";
const { Model, DataTypes, QueryTypes } = require("sequelize");
const sequelize = require("../config/database");

class User extends Model {
  // Scopes to eager-load business + user feature overrides
  static initScopes() {
    const { Business, BusinessCategory, Feature, UserFeature } = this.sequelize.models;

    this.addScope("withBusiness", {
      include: [
        {
          model: Business,
          as: "business",
          include: [{ model: BusinessCategory, as: "category" }],
        },
      ],
    });

    this.addScope("withUserFeatures", {
      include: [
        {
          model: Feature,
          as: "features",
          attributes: ["id", "code", "name", "description"],
          through: {
            model: UserFeature,
            attributes: ["enabled", "limit_value", "meta_json", "createdAt", "updatedAt"],
          },
        },
      ],
    });
  }

  // Convenience: get a user with business + user features in one go
  static async findWithFeaturesByPk(id) {
    if (!this._scopes || !this._scopes.withBusiness) this.initScopes();
    return this.scope("withBusiness", "withUserFeatures").findByPk(id);
  }

  // Map only the user's own overrides (from the through table)
  userFeatureMap() {
    const list = (this.get("features") || []).map(f => ({
      code: f.code,
      enabled: f.UserFeature?.enabled,
      limit_value: f.UserFeature?.limit_value ?? null,
      meta_json: f.UserFeature?.meta_json ?? null,
    }));
    return Object.fromEntries(list.map(f => [f.code, f]));
  }

  // Compute effective features for this user: user → business → default=false
  async getEffectiveFeatures() {
    const rows = await sequelize.query(
      `
      SELECT
        f.code,
        COALESCE(uf.enabled, bf.enabled, 0)      AS enabled,
        COALESCE(uf.limit_value, bf.limit_value) AS limit_value,
        COALESCE(uf.meta_json, bf.meta_json)     AS meta_json,
        CASE
          WHEN uf.enabled IS NOT NULL OR uf.limit_value IS NOT NULL OR uf.meta_json IS NOT NULL THEN 'user'
          WHEN bf.enabled IS NOT NULL OR bf.limit_value IS NOT NULL OR bf.meta_json IS NOT NULL THEN 'business'
          ELSE 'default'
        END AS source
      FROM Features f
      LEFT JOIN BusinessFeatures bf ON bf.feature_id = f.id AND bf.business_id = :businessId
      LEFT JOIN UserFeatures uf     ON uf.feature_id = f.id AND uf.user_id    = :userId
      ORDER BY f.code
      `,
      {
        replacements: { businessId: this.business_id, userId: this.id },
        type: QueryTypes.SELECT,
      }
    );

    const list = rows.map(r => ({
      code: r.code,
      enabled: !!r.enabled,
      limit_value: r.limit_value ?? null,
      meta_json: r.meta_json ?? null,
      source: r.source,
    }));
    const map = Object.fromEntries(
      list.map(x => [x.code, { enabled: x.enabled, limit_value: x.limit_value, meta_json: x.meta_json, source: x.source }])
    );

    return { list, map };
  }
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    full_name: { type: DataTypes.STRING, allowNull: false },
    email_address: { type: DataTypes.STRING, allowNull: false, unique: true },
    phone_number: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    roles: { type: DataTypes.JSON, allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
    business_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, modelName: "User", tableName: "Users", timestamps: true }
);

module.exports = User;
