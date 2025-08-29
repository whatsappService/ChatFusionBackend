"use strict";

const express = require("express");
const authenticateUser = require("../middleware/authMiddleware");
const requireFeature = require("../middleware/requireFeature");
const requirePermission = require("../middleware/requirePermission");
const multiUserController = require("../controllers/multiUserController");

const router = express.Router();
const chain = [
  authenticateUser,
  requireFeature("multi_user"),
  requirePermission("team.manage"),
];

router.get("/members", ...chain, multiUserController.listMembers);
router.post("/members", ...chain, multiUserController.createMember);
router.get("/members/:id", ...chain, multiUserController.getMember);
router.patch("/members/:id", ...chain, multiUserController.updateMember);
router.delete("/members/:id", ...chain, multiUserController.deleteMember);
router.post(
  "/members/:id/disable",
  ...chain,
  multiUserController.disableMember
);
router.post("/members/:id/enable", ...chain, multiUserController.enableMember);

// Invitations
router.post("/invitations", ...chain, multiUserController.createInvitation);
router.post(
  "/invitations/:token/resend",
  ...chain,
  multiUserController.resendInvitation
);
router.delete(
  "/invitations/:token",
  ...chain,
  multiUserController.revokeInvitation
);

module.exports = router;
