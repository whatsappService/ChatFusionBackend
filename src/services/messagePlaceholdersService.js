"use strict";
const { Op } = require("sequelize");
const MessagesPlaceholder = require("../models/messagesPlaceholder");

// fields we actually return, to avoid selecting unknown columns from scopes
const FIELDS = [
  "id",
  "code",
  "name_en",
  "name_ar",
  "description_en",
  "description_ar",
  "example_en",
  "example_ar",
  "is_active",
  "createdAt",
  "updatedAt",
];

const list = async (
  page = 0,
  limit = 50,
  search = "",
  includeInactive = false
) => {
  const offset = page * limit;

  const where = {};
  if (!includeInactive) {
    where.is_active = true;
  }

  if (search) {
    const like = { [Op.like]: `%${search}%` };
    where[Op.or] = [
      { code: like },
      { name_en: like },
      { name_ar: like },
      { description_en: like },
      { description_ar: like },
    ];
  }

  const { rows, count } = await MessagesPlaceholder.findAndCountAll({
    where,
    offset,
    limit,
    attributes: FIELDS,
    order: [
      ["is_active", "DESC"],
      ["code", "ASC"],
    ],
  });

  return { placeholders: rows, total: count, page, limit };
};

const getById = async (id) => {
  return await MessagesPlaceholder.findByPk(id, { attributes: FIELDS });
};

const create = async (data) => {
  // code unique handled by DB; let’s normalize here too
  if (data.code) data.code = String(data.code).trim();
  return await MessagesPlaceholder.create(data, {
    fields: FIELDS.filter((f) => f !== "id"),
  });
};

const update = async (id, data) => {
  const item = await MessagesPlaceholder.findByPk(id);
  if (!item) throw new Error("NotFound");

  if (data.code) data.code = String(data.code).trim();

  await item.update(data, {
    fields: FIELDS.filter((f) => !["id", "createdAt", "updatedAt"].includes(f)),
  });
  return await MessagesPlaceholder.findByPk(id, { attributes: FIELDS });
};

const remove = async (id) => {
  const item = await MessagesPlaceholder.findByPk(id);
  if (!item) throw new Error("NotFound");
  await item.destroy();
  return { message: "Placeholder deleted successfully" };
};

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
};
