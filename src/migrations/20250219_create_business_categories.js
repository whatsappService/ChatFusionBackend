'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('BusinessCategories', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      category_name: { type: Sequelize.STRING, allowNull: false, unique: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') }
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('BusinessCategories');
  }
};