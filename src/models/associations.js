const User = require("./user");
const Business = require("./business");
const BusinessCategory = require("./businessCategory");

// Define Associations
User.belongsTo(Business, { foreignKey: "business_id", as: "business" });
Business.belongsTo(BusinessCategory, {
  foreignKey: "category_id",
  as: "category",
});

module.exports = { User, Business, BusinessCategory };
