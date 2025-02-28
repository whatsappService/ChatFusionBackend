"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert("MessageTemplates", [
      {
        user_id: 1, // ✅ User-created template
        category_id: 1,
        template_name: "Welcome Message",
        message_ar: "مرحبًا بكم في متجرنا! كيف يمكننا مساعدتك اليوم؟",
        message_en: "Welcome to our store! How can we assist you today?",
        placeholders: JSON.stringify([]), // ✅ Ensure proper JSON format
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 1,
        category_id: 1,
        template_name: "Order Confirmation",
        message_ar: "شكرًا لك على طلبك! سيتم تسليمه قريبًا.",
        message_en: "Thank you for your order! It will be delivered soon.",
        placeholders: JSON.stringify(["{name}", "{order_id}"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 1,
        category_id: 1,
        template_name: "Discount Offer",
        message_ar: "عرض خاص! احصل على خصم 20% على جميع المنتجات هذا الأسبوع.",
        message_en: "Special Offer! Get 20% off on all products this week.",
        placeholders: JSON.stringify([
          "{name}",
          "{offer_price}",
          "{valid_until}",
        ]),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        user_id: 1,
        category_id: 2,
        template_name: "Tech Support Message",
        message_ar: "مرحبًا! كيف يمكننا مساعدتك في مشاكلك التقنية؟",
        message_en: "Hello! How can we assist you with your tech issues?",
        placeholders: JSON.stringify([]), // ✅ Ensure JSON empty array
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("MessageTemplates", { user_id: 1 }, {});
  },
};
