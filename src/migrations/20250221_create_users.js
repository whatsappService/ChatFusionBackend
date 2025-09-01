// src/migrations/20250221_create_users.js
"use strict";
module.exports = {
  up: async (q, Sequelize) => {
    await q.createTable("Users", {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      full_name: { type: Sequelize.STRING, allowNull: false },
      email_address: { type: Sequelize.STRING, allowNull: false, unique: true },
      phone_number: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: false },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      is_deleted: { type: Sequelize.BOOLEAN, defaultValue: false },
      business_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: "Businesses", key: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
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
    await q.addIndex("Users", ["email_address"], {
      name: "users_email_address",
    });
    await q.addIndex("Users", ["phone_number"], { name: "users_phone_number" });
    await q.addIndex("Users", ["business_id"], { name: "users_business_id" });
  },
  down: async (q) => {
    await q.dropTable("Users");
  },
};
