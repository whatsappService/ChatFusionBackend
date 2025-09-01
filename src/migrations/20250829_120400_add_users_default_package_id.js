// src/migrations/20250829_120400_add_users_default_package_id.js
"use strict";
module.exports = {
  async up(q, Sequelize) {
    await q.addColumn("Users", "default_package_id", {
      type: Sequelize.BIGINT.UNSIGNED,
      allowNull: true,
    });
    await q.addIndex("Users", ["default_package_id"], {
      name: "users_default_package_id",
    });
    await q.addConstraint("Users", {
      fields: ["default_package_id"],
      type: "foreign key",
      name: "fk_users_default_package",
      references: { table: "BusinessPackages", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });
  },
  async down(q) {
    try {
      await q.removeConstraint("Users", "fk_users_default_package");
    } catch {}
    try {
      await q.removeIndex("Users", "users_default_package_id");
    } catch {}
    try {
      await q.removeColumn("Users", "default_package_id");
    } catch {}
  },
};
