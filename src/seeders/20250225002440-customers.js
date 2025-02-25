"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert("Customers", [
      {
        id: 1,
        user_id: 1,
        category_id: 1, // Regular
        whatsapp_number: "+1234567890",
        profile_name: "John Doe",
        gender: "male",
        status: "verified",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
/*************  ✨ Codeium Command ⭐  *************/
  /**
   * When reverting {this filename}, we should remove all the customers created
   * by this migration. This is useful for testing and ensuring that the
   * migration is reversible.
   */
/******  1d1eb230-ff72-461c-9fae-48b7f918e6e6  *******/      {
        id: 2,
        user_id: 1,
        category_id: 2, // VIP
        whatsapp_number: "+9876543210",
        profile_name: "Jane Smith",
        gender: "female",
        status: "unverified",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete("Customers", null, {});
  },
};
