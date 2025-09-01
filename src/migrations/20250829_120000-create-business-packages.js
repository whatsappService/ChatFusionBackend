// src/migrations/20250829_120000_create_business_packages.js
"use strict";
module.exports = {
  async up(q, Sequelize) {
    await q.createTable("BusinessPackages", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      business_id: { type: Sequelize.INTEGER, allowNull: false },
      name: { type: Sequelize.STRING(128), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      is_system: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
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
    await q.addConstraint("BusinessPackages", {
      fields: ["business_id"],
      type: "foreign key",
      name: "fk_bp_business",
      references: { table: "Businesses", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await q.addConstraint("BusinessPackages", {
      fields: ["business_id", "name"],
      type: "unique",
      name: "uq_bp_business_name",
    });
  },
  async down(q) {
    await q.dropTable("BusinessPackages");
  },
};
