// src/migrations/20250829_120100_create_business_package_features.js
"use strict";
module.exports = {
  async up(q, Sequelize) {
    await q.createTable("BusinessPackageFeatures", {
      package_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
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
    await q.addConstraint("BusinessPackageFeatures", {
      fields: ["package_id", "feature_id"],
      type: "primary key",
      name: "pk_bpf",
    });
    await q.addConstraint("BusinessPackageFeatures", {
      fields: ["package_id"],
      type: "foreign key",
      name: "fk_bpf_package",
      references: { table: "BusinessPackages", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await q.addConstraint("BusinessPackageFeatures", {
      fields: ["feature_id"],
      type: "foreign key",
      name: "fk_bpf_feature",
      references: { table: "Features", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },
  async down(q) {
    await q.dropTable("BusinessPackageFeatures");
  },
};
