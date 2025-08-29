"use strict";

const svc = require("../services/apiAccessService");

exports.listKeys = async (req, res, next) => {
  try {
    res.json(await svc.listKeys(req.user.business_id));
  } catch (e) {
    next(e);
  }
};

exports.createKey = async (req, res, next) => {
  try {
    res.status(201).json(await svc.createKey(req.user.business_id));
  } catch (e) {
    next(e);
  }
};

exports.getKey = async (req, res, next) => {
  try {
    res.json(await svc.getKey(req.user.business_id));
  } catch (e) {
    next(e);
  }
};

exports.updateKey = async (req, res, next) => {
  try {
    res.status(400).json(await svc.updateKey());
  } catch (e) {
    next(e);
  }
};

exports.rotateKey = async (req, res, next) => {
  try {
    res.json(await svc.rotateKey(req.user.business_id));
  } catch (e) {
    next(e);
  }
};

exports.revokeKey = async (req, res, next) => {
  try {
    res.json(await svc.revokeKey(req.user.business_id));
  } catch (e) {
    next(e);
  }
};

exports.deleteKey = async (req, res, next) => {
  try {
    res.json(await svc.deleteKey(req.user.business_id));
  } catch (e) {
    next(e);
  }
};

exports.listScopes = async (_req, res, next) => {
  try {
    res.json(await svc.listScopes());
  } catch (e) {
    next(e);
  }
};
