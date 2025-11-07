"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Messages", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      business_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM("sent", "delivered", "failed", "pending"),
        allowNull: false,
        defaultValue: "pending",
      },
      whatsapp_message_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      media_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      media_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      message_type: {
        type: Sequelize.ENUM("single", "bulk", "group"),
        allowNull: false,
        defaultValue: "single",
      },
      bulk_message_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      group_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      delivered_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      failed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
      },
    });

    // Add indexes
    await queryInterface.addIndex("Messages", ["business_id"], {
      name: "messages_business_id",
    });
    await queryInterface.addIndex("Messages", ["user_id"], {
      name: "messages_user_id",
    });
    await queryInterface.addIndex("Messages", ["status"], {
      name: "messages_status",
    });
    await queryInterface.addIndex("Messages", ["phone"], {
      name: "messages_phone",
    });
    await queryInterface.addIndex("Messages", ["bulk_message_id"], {
      name: "messages_bulk_id",
    });
    await queryInterface.addIndex("Messages", ["sent_at"], {
      name: "messages_sent_at",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Messages");
  },
};


