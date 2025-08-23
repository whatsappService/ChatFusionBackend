"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert("CustomerCategories", [
      {
        id: 1,
        user_id: 1,
        name: "Regular",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        user_id: 1,
        name: "VIP",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        user_id: 1,
        name: "Wholesale",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete("CustomerCategories", null, {});
  },
};
