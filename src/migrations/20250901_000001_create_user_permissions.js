// src/migrations/20250901_000001_create_user_permissions.js
"use strict";
/** Per-user permission overrides (ALLOW / DENY). Unique on (user_id, perm). */
module.exports = {
  async up(q, Sequelize) {
    await q.createTable("UserPermissions", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      perm: { type: Sequelize.STRING(128), allowNull: false },
      effect: {
        type: Sequelize.ENUM("ALLOW", "DENY"),
        allowNull: false,
        defaultValue: "ALLOW",
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
    await q.addIndex("UserPermissions", ["user_id"], {
      name: "idx_userpermissions_user",
    });
    await q.addIndex("UserPermissions", ["perm"], {
      name: "idx_userpermissions_perm",
    });
    await q.addConstraint("UserPermissions", {
      fields: ["user_id", "perm"],
      type: "unique",
      name: "uq_userpermissions_user_perm",
    });
  },
  async down(q) {
    await q.dropTable("UserPermissions");
    try {
      await q.sequelize.query(
        "DROP TYPE IF EXISTS enum_UserPermissions_effect"
      );
    } catch (_) {}
  },
};
