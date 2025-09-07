// src/migrations/20250220_create_businesses.js
"use strict";
const { DataTypes } = require("sequelize");

module.exports = {
  up: async (q, Sequelize) => {
    await q.createTable("Businesses", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      business_name: { type: Sequelize.STRING, allowNull: false },
      business_phone_number: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: true },
      api_key: { type: DataTypes.STRING, allowNull: true },

      // ✅ Fallback timezone for the whole business (optional per-user override)
      default_timezone: { type: Sequelize.STRING(64), allowNull: true },

      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      is_deleted: { type: Sequelize.BOOLEAN, defaultValue: false },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "BusinessCategories", key: "id" },
        onDelete: "SET NULL",
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

    // (optional) index for lookups or reporting
    await q.addIndex("Businesses", ["default_timezone"], {
      name: "biz_default_timezone",
    });
  },
  down: async (q) => {
    await q.dropTable("Businesses");
  },
};
