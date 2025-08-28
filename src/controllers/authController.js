const authService = require("../services/authService");

exports.login = async (req, res) => {
  try {
    const { email_address, password } = req.body;
    const payload = await authService.login(email_address, password);
    res.json(payload); // payload includes tokens, user, features, overrides, toggles
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const payload = await authService.register(req.body);
    res.status(201).json(payload);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshToken(refreshToken);
    res.json(tokens);
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};

exports.getAuthUser = async (req, res) => {
  try {
    const payload = await authService.getAuthUser(req.user.id);
    res.json(payload); // same rich payload as login
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
};
