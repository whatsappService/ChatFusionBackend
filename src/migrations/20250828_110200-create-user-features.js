"use strict";
module.exports = {
  async up(q, Sequelize) {
    await q.createTable("UserFeatures", {
      user_id:     { type: Sequelize.INTEGER, allowNull: false },      // <- signed
      feature_id:  { type: Sequelize.BIGINT.UNSIGNED, allowNull: false },
      enabled:     { type: Sequelize.BOOLEAN, allowNull: true },       // NULL => inherit
      limit_value: { type: Sequelize.INTEGER, allowNull: true },
      meta_json:   { type: Sequelize.JSON, allowNull: true },
      createdAt:   { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt:   { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await q.addConstraint("UserFeatures", { fields:["user_id","feature_id"], type:"primary key", name:"pk_user_features" });
    await q.addConstraint("UserFeatures", {
      fields:["user_id"], type:"foreign key",
      references:{ table:"Users", field:"id" },
      onUpdate:"CASCADE", onDelete:"CASCADE"
    });
    await q.addConstraint("UserFeatures", {
      fields:["feature_id"], type:"foreign key",
      references:{ table:"Features", field:"id" },
      onUpdate:"CASCADE", onDelete:"CASCADE"
    });
  },
  async down(q){ await q.dropTable("UserFeatures"); }
};
