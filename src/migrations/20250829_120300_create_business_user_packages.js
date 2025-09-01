// src/migrations/20250829_120300_create_business_user_packages.js
"use strict";
module.exports = {
  async up(q, Sequelize) {
    await q.createTable("BusinessUserPackages", {
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      package_id: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
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
    await q.addConstraint("BusinessUserPackages", {
      fields: ["user_id", "package_id"],
      type: "primary key",
      name: "pk_bup",
    });
    await q.addConstraint("BusinessUserPackages", {
      fields: ["user_id"],
      type: "foreign key",
      name: "fk_bup_user",
      references: { table: "Users", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await q.addConstraint("BusinessUserPackages", {
      fields: ["package_id"],
      type: "foreign key",
      name: "fk_bup_package",
      references: { table: "BusinessPackages", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
  },
  async down(q) {
    await q.dropTable("BusinessUserPackages");
  },
};
