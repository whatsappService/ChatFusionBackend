const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token)
    return res.status(401).json({ error: "Access denied. No token provided." });

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret)
      throw new Error("JWT_SECRET is missing from environment variables.");

    const decoded = jwt.verify(token.replace("Bearer ", ""), secret);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ error: "Invalid or expired token." });
  }
};
