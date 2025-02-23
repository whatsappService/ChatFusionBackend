'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('Customers', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      user_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'Users', key: 'id' }, onDelete: 'CASCADE' },
      category_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'CustomerCategories', key: 'id' }, onDelete: 'SET NULL' },
      whatsapp_number: { type: Sequelize.STRING, allowNull: false, unique: true },
      profile_name: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.ENUM('verified', 'unverified'), defaultValue: 'unverified' },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('Customers');
  }
};