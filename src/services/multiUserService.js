"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { User } = require("../models/associations");

const sanitizeUser = (u) => {
  if (!u) return u;
  const json = typeof u.toJSON === "function" ? u.toJSON() : u;
  delete json.password;
  return json;
};

const ensureInviteSecret = () => {
  if (!process.env.JWT_REFRESH_SECRET) {
    throw new Error("Missing JWT_REFRESH_SECRET for invitations");
  }
};

exports.listMembers = async (business_id) => {
  const list = await User.findAll({
    where: { business_id },
    order: [["createdAt", "DESC"]],
  });
  return list.map(sanitizeUser);
};

exports.createMember = async (business_id, data) => {
  const {
    full_name,
    email_address,
    phone_number,
    password,
    roles = ["member"],
    is_active = true,
  } = data;

  if (!full_name || !email_address || !phone_number || !password) {
    const e = new Error("Missing required fields");
    e.status = 400;
    throw e;
  }

  const hashed = await bcrypt.hash(password, 10);
  const member = await User.create({
    full_name,
    email_address,
    phone_number,
    password: hashed,
    roles,
    is_active,
    is_deleted: false,
    business_id,
  });

  return sanitizeUser(member);
};

exports.getMember = async (business_id, id) => {
  const member = await User.findOne({ where: { id, business_id } });
  if (!member) {
    const e = new Error("Member not found");
    e.status = 404;
    throw e;
  }
  return sanitizeUser(member);
};

exports.updateMember = async (business_id, id, body) => {
  const member = await User.findOne({ where: { id, business_id } });
  if (!member) {
    const e = new Error("Member not found");
    e.status = 404;
    throw e;
  }
  const updatable = ["full_name", "email_address", "phone_number", "roles", "is_active", "is_deleted"];
  for (const k of updatable) if (k in body) member[k] = body[k];
  if (body.password) member.password = await bcrypt.hash(body.password, 10);
  await member.save();
  return sanitizeUser(member);
};

exports.deleteMember = async (business_id, id) => {
  const member = await User.findOne({ where: { id, business_id } });
  if (!member) {
    const e = new Error("Member not found");
    e.status = 404;
    throw e;
  }
  await member.destroy();
  return { ok: true };
};

exports.disableMember = async (business_id, id) => {
  const member = await User.findOne({ where: { id, business_id } });
  if (!member) { const e = new Error("Member not found"); e.status = 404; throw e; }
  member.is_active = false;
  await member.save();
  return sanitizeUser(member);
};

exports.enableMember = async (business_id, id) => {
  const member = await User.findOne({ where: { id, business_id } });
  if (!member) { const e = new Error("Member not found"); e.status = 404; throw e; }
  member.is_active = true;
  await member.save();
  return sanitizeUser(member);
};

// Invitations (stateless JWT)
exports.createInvitation = async (inviter, { email_address, roles = ["member"], ttl = "3d" }) => {
  ensureInviteSecret();
  if (!email_address) { const e = new Error("email_address is required"); e.status = 400; throw e; }
  const token = jwt.sign(
    {
      typ: "invite",
      business_id: inviter.business_id,
      inviter_id: inviter.id,
      email_address,
      roles,
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: ttl }
  );
  return { token };
};

exports.resendInvitation = async (inviter, { email_address, roles = ["member"], ttl = "3d" }) => {
  return this.createInvitation(inviter, { email_address, roles, ttl });
};

exports.revokeInvitation = async () => {
  // Would require a token blacklist store (Redis/DB).
  const e = new Error("Revocation requires a token blacklist store (not implemented)");
  e.status = 501;
  throw e;
};
