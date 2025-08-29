"use strict";

const express = require("express");
const router = express.Router();

const businessController = require("../controllers/businessController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.post(
  "/",
  authMiddleware,
  roleMiddleware(["super-admin"]),
  businessController.createBusiness
);

router.get("/", authMiddleware, businessController.getAllBusinesses);
router.get("/:id", authMiddleware, businessController.getBusinessById);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["super-admin"]),
  businessController.updateBusiness
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["super-admin"]),
  businessController.deleteBusiness
);

module.exports = router;
