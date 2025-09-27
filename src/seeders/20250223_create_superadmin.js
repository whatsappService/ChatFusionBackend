"use strict";
const bcrypt = require("bcryptjs");

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Insert Business Categories
    await queryInterface.bulkInsert("BusinessCategories", [
      {
        id: 1,
        category_name: "Retail",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        category_name: "Tech",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Insert Businesses
    await queryInterface.bulkInsert("Businesses", [
      {
        id: 1,
        business_name: "Super Admin Business",
        business_phone_number: "0000000000",
        email: "business@example.com",
        is_active: true,
        is_deleted: false,
        category_id: 1, // Reference a valid category
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // Hash Super Admin password
    const hashedPassword = await bcrypt.hash("password", 10);

    // Insert Super Admin User with full_name
    await queryInterface.bulkInsert("Users", [
      {
        id: 1,
        full_name: "Super Admin", // ✅ Added full_name
        email_address: "superadmin@superadmin.com",
        phone_number: "1234567890",
        password: hashedPassword,
        is_active: true,
        is_deleted: false,
        business_id: 1, // Link to the existing business
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("Users", { id: 1 });
    await queryInterface.bulkDelete("Businesses", { id: 1 });
    await queryInterface.bulkDelete("BusinessCategories", null, {});
  },
};
