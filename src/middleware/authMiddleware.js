const jwt = require("jsonwebtoken");
const User = require("../models/user");

const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: User not found" });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error("❌ Authentication error:", err.message);
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

module.exports = authenticateUser;
