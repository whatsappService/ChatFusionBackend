"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert("MessageTemplates", [
      {
        id: 1,
        user_id: null, // ✅ System Template (No user)
        category_id: 1, // Retail Category
        template_name: "Order Confirmation",
        message_ar:
          "مرحبًا {name}، تم تأكيد طلبك لدى {business_name} بسعر {price}. شكراً لك!",
        message_en:
          "Hello {name}, your order at {business_name} is confirmed at {price}. Thank you!",
        placeholders: JSON.stringify(["{name}", "{business_name}", "{price}"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        user_id: null, // ✅ System Template
        category_id: 2, // Tech Category
        template_name: "Discount Offer",
        message_ar:
          "مرحبًا {name}، لدينا عرض خاص! السعر الأصلي {price}، والسعر المخفض {offer_price}. انتهز الفرصة!",
        message_en:
          "Hello {name}, we have a special offer! Original price {price}, discounted price {offer_price}. Grab it now!",
        placeholders: JSON.stringify(["{name}", "{price}", "{offer_price}"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        user_id: null, // ✅ System Template
        category_id: 1, // Retail Category
        template_name: "Payment Reminder",
        message_ar:
          "مرحبًا {name}، هذا تذكير بدفعتك المستحقة لشركة {business_name}. يرجى الدفع قبل {date}.",
        message_en:
          "Hello {name}, this is a reminder for your due payment at {business_name}. Please pay before {date}.",
        placeholders: JSON.stringify(["{name}", "{business_name}", "{date}"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 4,
        user_id: null, // ✅ System Template
        category_id: 2, // Tech Category
        template_name: "Subscription Renewal",
        message_ar:
          "مرحبًا {name}، اشتراكك في {business_name} سينتهي في {date}. يرجى التجديد لتجنب الانقطاع.",
        message_en:
          "Hello {name}, your subscription with {business_name} will expire on {date}. Please renew to avoid disruption.",
        placeholders: JSON.stringify(["{name}", "{business_name}", "{date}"]),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete("MessageTemplates", { user_id: null }, {}); // Remove only system templates
  },
};
