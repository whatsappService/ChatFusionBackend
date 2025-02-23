const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

router.get(
  "/",
  authMiddleware,
  roleMiddleware(["super-admin", "admin"]),
  userController.getAllUsers
);
router.get("/:id", authMiddleware, userController.getUserById);
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware(["super-admin", "admin"]),
  userController.updateUser
);
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware(["super-admin"]),
  userController.deleteUser
);
router.post("/update-profile", authMiddleware, userController.updateProfile);
router.post("/change-password", authMiddleware, userController.changePassword);

module.exports = router;
