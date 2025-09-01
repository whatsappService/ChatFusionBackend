// src/migrations/20250222_create_reports.js
"use strict";
module.exports = {
  up: async (q, Sequelize) => {
    await q.createTable("Reports", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Users", key: "id" },
        onDelete: "CASCADE",
      },
      report_data: { type: Sequelize.JSON, allowNull: false },
      generated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },
  down: async (q) => {
    await q.dropTable("Reports");
  },
};
