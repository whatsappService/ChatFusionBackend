// src/models/user.js
"use strict";
const { Model, DataTypes, QueryTypes } = require("sequelize");
const sequelize = require("../config/database");

class User extends Model {
  static initScopes() {
    const {
      Business,
      BusinessCategory,
      Feature,
      UserFeature,
      BusinessPackage,
      BusinessPackagePermission,
      UserPermission,
    } = this.sequelize.models;

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

    this.addScope("withPackages", {
      include: [
        {
          model: BusinessPackage,
          as: "assignedPackages",
          required: false,
          through: { attributes: [] },
          include: [
            {
              model: BusinessPackagePermission,
              as: "permissions",
              required: false,
              attributes: ["id", "perm"],
            },
          ],
        },
      ],
    });

    this.addScope("withPermissionOverrides", {
      include: [{ model: UserPermission, as: "permissionOverrides" }],
    });
  }

  static async findWithFeaturesByPk(id) {
    if (!this._scopes || !this._scopes.withBusiness) this.initScopes();
    return this.scope(
      "withBusiness",
      "withUserFeatures",
      "withPackages",
      "withPermissionOverrides"
    ).findByPk(id);
  }

  // ---------- FEATURES ----------
  userFeatureMap() {
    const list = (this.get("features") || []).map((f) => ({
      code: f.code,
      enabled: f.UserFeature?.enabled,
      limit_value: f.UserFeature?.limit_value ?? null,
      meta_json: f.UserFeature?.meta_json ?? null,
    }));
    return Object.fromEntries(list.map((f) => [f.code, f]));
  }

  /**
   * Effective features (priority):
   * 1) UserFeature override (if NOT NULL)
   * 2) BusinessFeature hard cap (0 disables even if package enables)
   * 3) Union of assigned packages' feature rules (by same business)
   * 4) Default disabled
   */
  async getEffectiveFeatures() {
    const rows = await sequelize.query(
      `
      SELECT
        f.code AS code,
        CASE
          WHEN uf.enabled IS NOT NULL THEN uf.enabled
          WHEN bf.enabled = 0 THEN 0
          ELSE GREATEST(COALESCE(bf.enabled, 0), COALESCE(MAX(bpf.enabled), 0))
        END AS enabled,
        COALESCE(uf.limit_value, bf.limit_value, MAX(bpf.limit_value)) AS limit_value,
        COALESCE(uf.meta_json, bf.meta_json, JSON_EXTRACT(ANY_VALUE(bpf.meta_json), '$')) AS meta_json,
        CASE
          WHEN uf.enabled IS NOT NULL OR uf.limit_value IS NOT NULL OR uf.meta_json IS NOT NULL THEN 'user'
          WHEN bf.enabled IS NOT NULL OR bf.limit_value IS NOT NULL OR bf.meta_json IS NOT NULL THEN 'business'
          WHEN COUNT(bpf.feature_id) > 0 THEN 'package'
          ELSE 'default'
        END AS source
      FROM Features f
      LEFT JOIN BusinessFeatures bf
        ON bf.feature_id = f.id AND bf.business_id = :businessId
      LEFT JOIN UserFeatures uf
        ON uf.feature_id = f.id AND uf.user_id = :userId
      LEFT JOIN BusinessUserPackages bup
        ON bup.user_id = :userId
      LEFT JOIN BusinessPackages bp
        ON bp.id = bup.package_id AND bp.business_id = :businessId
      LEFT JOIN BusinessPackageFeatures bpf
        ON bpf.package_id = bp.id AND bpf.feature_id = f.id
      GROUP BY f.id, f.code, uf.enabled, uf.limit_value, uf.meta_json, bf.enabled, bf.limit_value, bf.meta_json
      ORDER BY f.code
      `,
      {
        replacements: { businessId: this.business_id, userId: this.id },
        type: QueryTypes.SELECT,
      }
    );

    const list = rows.map((r) => ({
      code: r.code,
      enabled: !!r.enabled,
      limit_value: r.limit_value ?? null,
      meta_json: r.meta_json ?? null,
      source: r.source,
    }));
    const map = Object.fromEntries(
      list.map((x) => [
        x.code,
        {
          enabled: x.enabled,
          limit_value: x.limit_value,
          meta_json: x.meta_json,
          source: x.source,
        },
      ])
    );
    return { list, map };
  }

  // ---------- PERMISSIONS ----------
  /**
   * Effective permissions:
   *   ALLOW = union(packages for same business ∪ user-overrides(ALLOW))
   *   DENY  = subtract user-overrides(DENY)
   *   Wildcard '*' in ALLOW → superuser (returns ['*'])
   */
  async getEffectivePermissions() {
    const rows = await sequelize.query(
      `
      -- package permissions (by business)
      SELECT DISTINCT bpp.perm AS perm, 'PKG' AS src
      FROM BusinessUserPackages bup
      JOIN BusinessPackages bp ON bp.id = bup.package_id AND bp.business_id = :businessId
      JOIN BusinessPackagePermissions bpp ON bpp.package_id = bp.id
      WHERE bup.user_id = :userId

      UNION ALL

      -- user overrides (ALLOW)
      SELECT up.perm AS perm, 'ALLOW' AS src
      FROM UserPermissions up
      WHERE up.user_id = :userId AND up.effect = 'ALLOW'

      UNION ALL

      -- user overrides (DENY) – we mark them; remove later in JS
      SELECT CONCAT('DENY:', up.perm) AS perm, 'DENY' AS src
      FROM UserPermissions up
      WHERE up.user_id = :userId AND up.effect = 'DENY'
      `,
      {
        replacements: { businessId: this.business_id, userId: this.id },
        type: QueryTypes.SELECT,
      }
    );

    const allow = new Set();
    const deny = new Set();

    for (const r of rows) {
      if (r.perm.startsWith("DENY:")) {
        deny.add(r.perm.slice(5));
      } else {
        allow.add(r.perm);
      }
    }

    // wildcard means full access
    if (allow.has("*")) return ["*"];

    // subtract denies
    for (const d of deny) allow.delete(d);

    return Array.from(allow).sort();
  }

  async hasPermission(perm) {
    const perms = await this.getEffectivePermissions();
    return perms.includes("*") || perms.includes(perm);
  }
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    full_name: { type: DataTypes.STRING, allowNull: false },
    email_address: { type: DataTypes.STRING, allowNull: false, unique: true },
    phone_number: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },

    // removed: roles

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    business_id: { type: DataTypes.INTEGER, allowNull: false },

    default_package_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: true },
  },
  {
    sequelize,
    modelName: "User",
    tableName: "Users",
    timestamps: true,
  }
);

module.exports = User;
