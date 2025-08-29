"use strict";

const { QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const { User, ScheduledMessage } = require("../models/associations");

const normalizeRange = (q = {}) => {
  const from = q.from ? new Date(q.from) : new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const to   = q.to   ? new Date(q.to)   : new Date();
  return { from, to };
};

exports.getOverview = async (business_id) => {
  const users = await User.count({ where: { business_id } });

  const customers = await sequelize.query(
    `SELECT COUNT(c.id) AS cnt
     FROM Customers c
     JOIN Users u ON u.id = c.user_id
     WHERE u.business_id = :business_id`,
    { type: QueryTypes.SELECT, replacements: { business_id } }
  ).then(r => Number(r[0]?.cnt || 0));

  const templates = await sequelize.query(
    `SELECT COUNT(mt.id) AS cnt
     FROM MessageTemplates mt
     LEFT JOIN Users u ON u.id = mt.user_id
     WHERE (mt.user_id IS NULL) OR (u.business_id = :business_id)`,
    { type: QueryTypes.SELECT, replacements: { business_id } }
  ).then(r => Number(r[0]?.cnt || 0));

  const schedules = await ScheduledMessage.count({ where: { business_id } });

  return { totals: { users, customers, templates, schedules } };
};

exports.getDailyMessages = async (business_id, query) => {
  const { from, to } = normalizeRange(query);
  const rows = await sequelize.query(
    `SELECT DATE(createdAt) as d, COUNT(*) as n
     FROM ScheduledMessages
     WHERE business_id = :business_id
       AND createdAt BETWEEN :from AND :to
     GROUP BY DATE(createdAt)
     ORDER BY d ASC`,
    { type: QueryTypes.SELECT, replacements: { business_id, from, to } }
  );
  return { from, to, rows };
};

exports.getDeliverability = async (business_id) => {
  const rows = await sequelize.query(
    `SELECT status, COUNT(*) as n
     FROM ScheduledMessages
     WHERE business_id = :business_id
     GROUP BY status`,
    { type: QueryTypes.SELECT, replacements: { business_id } }
  );
  return { breakdown: Object.fromEntries(rows.map(r => [r.status, Number(r.n)])) };
};

exports.getContactsGrowth = async (business_id, query) => {
  const { from, to } = normalizeRange(query);
  const rows = await sequelize.query(
    `SELECT DATE(c.createdAt) as d, COUNT(*) as n
     FROM Customers c
     JOIN Users u ON u.id = c.user_id
     WHERE u.business_id = :business_id
       AND c.createdAt BETWEEN :from AND :to
     GROUP BY DATE(c.createdAt)
     ORDER BY d ASC`,
    { type: QueryTypes.SELECT, replacements: { business_id, from, to } }
  );
  return { from, to, rows };
};

exports.getTemplateUsage = async (business_id) => {
  const byOwner = await sequelize.query(
    `SELECT CASE WHEN mt.user_id IS NULL THEN 'system' ELSE 'user' END as owner_type,
            COUNT(*) as n
     FROM MessageTemplates mt
     LEFT JOIN Users u ON u.id = mt.user_id
     WHERE (mt.user_id IS NULL) OR (u.business_id = :business_id)
     GROUP BY owner_type`,
    { type: QueryTypes.SELECT, replacements: { business_id } }
  );
  return { byOwner };
};

exports.exportCsv = async (business_id) => {
  const totals = await this.getOverview(business_id);
  const { users, customers, templates, schedules } = totals.totals;
  const csv = [
    "metric,value",
    `users,${users}`,
    `customers,${customers}`,
    `templates,${templates}`,
    `schedules,${schedules}`,
  ].join("\n");
  return csv;
};
