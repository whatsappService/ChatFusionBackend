"use strict";
module.exports = {
  async up(q, Sequelize) {
    await q.createTable("ScheduledMessages", {
      id:               { type: Sequelize.STRING(36), primaryKey: true }, // UUID v4
      business_id:      { type: Sequelize.INTEGER, allowNull: false },     // <- signed
      created_by_user:  { type: Sequelize.INTEGER, allowNull: true },      // <- signed
      to_number:        { type: Sequelize.STRING(32), allowNull: false },
      body:             { type: Sequelize.TEXT, allowNull: true },
      media_url:        { type: Sequelize.TEXT, allowNull: true },
      variables_json:   { type: Sequelize.JSON, allowNull: true },
      type:             { type: Sequelize.ENUM("ONE_OFF","CRON"), allowNull: false },
      send_at_utc:      { type: Sequelize.DATE, allowNull: true },
      cron_expr:        { type: Sequelize.STRING(128), allowNull: true },
      timezone:         { type: Sequelize.STRING(64), allowNull: false, defaultValue: "Asia/Hebron" },
      status:           { type: Sequelize.ENUM("ACTIVE","PAUSED","CANCELLED"), allowNull: false, defaultValue: "ACTIVE" },
      last_run_at:      { type: Sequelize.DATE, allowNull: true },
      next_run_at:      { type: Sequelize.DATE, allowNull: true },
      max_attempts:     { type: Sequelize.INTEGER, allowNull: false, defaultValue: 3 },
      createdAt:        { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt:        { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await q.addConstraint("ScheduledMessages", {
      fields:["business_id"], type:"foreign key",
      references:{ table:"Businesses", field:"id" },
      onUpdate:"CASCADE", onDelete:"CASCADE"
    });
    await q.addConstraint("ScheduledMessages", {
      fields:["created_by_user"], type:"foreign key",
      references:{ table:"Users", field:"id" },
      onUpdate:"CASCADE", onDelete:"SET NULL"
    });
    await q.addIndex("ScheduledMessages", ["business_id", "status"]);
    await q.addIndex("ScheduledMessages", ["next_run_at"]);
  },
  async down(q){
    await q.dropTable("ScheduledMessages");
    // cleanup ENUMs if your dialect needs it:
    await q.sequelize.query("DROP TYPE IF EXISTS enum_ScheduledMessages_type");
    await q.sequelize.query("DROP TYPE IF EXISTS enum_ScheduledMessages_status");
  }
};
