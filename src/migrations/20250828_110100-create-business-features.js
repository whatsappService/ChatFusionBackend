// src/migrations/20250828_110100_create_business_features.js
"use strict";
module.exports = {
  async up(q, Sequelize) {
    await q.createTable("BusinessFeatures", {
      business_id: { type: Sequelize.INTEGER, allowNull: false },
      feature_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      limit_value: { type: Sequelize.INTEGER, allowNull: true },
      meta_json: { type: Sequelize.JSON, allowNull: true },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });
    await q.addConstraint("BusinessFeatures", {
      fields: ["business_id", "feature_id"],
      type: "primary key",
      name: "pk_business_features",
    });
    await q.addConstraint("BusinessFeatures", {
      fields: ["business_id"],
      type: "foreign key",
      references: { table: "Businesses", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await q.addConstraint("BusinessFeatures", {
      fields: ["feature_id"],
      type: "foreign key",
      references: { table: "Features", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await q.addIndex("BusinessFeatures", ["business_id", "enabled"], {
      name: "business_features_business_id_enabled",
    });
  },
  async down(q) {
    await q.dropTable("BusinessFeatures");
  },
};
