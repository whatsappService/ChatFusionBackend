// src/migrations/20250829_120200_create_business_package_permissions.js
"use strict";
module.exports = {
  async up(q, Sequelize) {
    await q.createTable("BusinessPackagePermissions", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      package_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
      perm: { type: Sequelize.STRING(128), allowNull: false },
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
    await q.addConstraint("BusinessPackagePermissions", {
      fields: ["package_id"],
      type: "foreign key",
      name: "fk_bpp_package",
      references: { table: "BusinessPackages", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await q.addConstraint("BusinessPackagePermissions", {
      fields: ["package_id", "perm"],
      type: "unique",
      name: "uq_bpp_package_perm",
    });
  },
  async down(q) {
    await q.dropTable("BusinessPackagePermissions");
  },
};
