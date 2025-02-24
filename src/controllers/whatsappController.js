const whatsappService = require("../services/whatsappService");

exports.getWhatsappAccountInfo = async (req, res) => {
  try {
    const userId = req.user.id;
    const apiKey = await whatsappService.getApiKeyByUser(userId);

    if (!apiKey) {
      return res
        .status(404)
        .json({ message: "API key not found for this business" });
    }

    const whatsappAccountInfo = await whatsappService.fetchWhatsappAccountInfo(
      apiKey
    );
    res.json(whatsappAccountInfo);
  } catch (error) {
    console.error("Error fetching WhatsApp account info:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ✅ Reset API Key (Generates a new one, requires password verification)
exports.resetBusinessApiKey = async (req, res) => {
  try {
    const { password } = req.body;
    const newApiKey = await whatsappService.resetBusinessApiKey(
      req.user.id,
      password
    );
    res.json({
      success: true,
      message: "API Key reset successfully",
      apiKey: newApiKey,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ✅ Update API Key (Requires password verification)
exports.updateBusinessApiKey = async (req, res) => {
  try {
    const { apiKey, password } = req.body;
    const updatedApiKey = await whatsappService.updateBusinessApiKey(
      req.user.id,
      apiKey,
      password
    );
    res.json({
      success: true,
      message: "API Key updated successfully",
      apiKey: updatedApiKey,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
// ✅ Get WhatsApp Authentication Status
// ✅ Get WhatsApp Authentication Status
exports.getWhatsAppStatus = async (req, res) => {
  try {
    const status = await whatsappService.fetchWhatsAppStatus(req.user.id);
    res.json(status);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// ✅ Connect to WhatsApp (Retrieve QR Code)
exports.connectToWhatsApp = async (req, res) => {
  try {
    const qrData = await whatsappService.connectToWhatsApp(req.user.id);
    res.json(qrData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
