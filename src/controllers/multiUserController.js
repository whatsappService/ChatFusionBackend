"use strict";

const svc = require("../services/multiUserService");

exports.listMembers = async (req, res, next) => {
  try { res.json(await svc.listMembers(req.user.business_id)); }
  catch (e) { next(e); }
};

exports.createMember = async (req, res, next) => {
  try { res.status(201).json(await svc.createMember(req.user.business_id, req.body)); }
  catch (e) {
    if (e.name === "SequelizeUniqueConstraintError") return res.status(409).json({ error: "Email or phone is already in use" });
    next(e);
  }
};

exports.getMember = async (req, res, next) => {
  try { res.json(await svc.getMember(req.user.business_id, req.params.id)); }
  catch (e) { next(e); }
};

exports.updateMember = async (req, res, next) => {
  try { res.json(await svc.updateMember(req.user.business_id, req.params.id, req.body)); }
  catch (e) {
    if (e.name === "SequelizeUniqueConstraintError") return res.status(409).json({ error: "Email or phone is already in use" });
    next(e);
  }
};

exports.deleteMember = async (req, res, next) => {
  try { res.json(await svc.deleteMember(req.user.business_id, req.params.id)); }
  catch (e) { next(e); }
};

exports.disableMember = async (req, res, next) => {
  try { res.json(await svc.disableMember(req.user.business_id, req.params.id)); }
  catch (e) { next(e); }
};

exports.enableMember = async (req, res, next) => {
  try { res.json(await svc.enableMember(req.user.business_id, req.params.id)); }
  catch (e) { next(e); }
};

exports.createInvitation = async (req, res, next) => {
  try { res.status(201).json(await svc.createInvitation(req.user, req.body)); }
  catch (e) { next(e); }
};

exports.resendInvitation = async (req, res, next) => {
  try { res.json(await svc.resendInvitation(req.user, req.body)); }
  catch (e) { next(e); }
};

exports.revokeInvitation = async (req, res, next) => {
  try { res.json(await svc.revokeInvitation()); }
  catch (e) { next(e); }
};
