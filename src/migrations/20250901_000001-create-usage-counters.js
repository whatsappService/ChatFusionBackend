"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;
    await queryInterface.createTable("UsageCounters", {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      business_id: {
        // <- make INTEGER to match Businesses.id
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      user_id: {
        // <- make INTEGER to match Users.id
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      feature_code: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      period_key: {
        type: DataTypes.STRING(32), // e.g. "2025-09-01" or "2025-09"
        allowNull: false,
      },
      used: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal(
          "CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ),
      },
    });

    await queryInterface.addConstraint("UsageCounters", {
      fields: ["business_id", "user_id", "feature_code", "period_key"],
      type: "unique",
      name: "uniq_usage_scope",
    });

    await queryInterface.addIndex(
      "UsageCounters",
      ["business_id", "feature_code", "period_key"],
      {
        name: "idx_usage_biz_feature_period",
      }
    );
    await queryInterface.addIndex(
      "UsageCounters",
      ["user_id", "feature_code", "period_key"],
      {
        name: "idx_usage_user_feature_period",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("UsageCounters");
  },
};
