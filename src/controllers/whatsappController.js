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
exports.checkWhatsAppNumber = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res
        .status(400)
        .json({ success: false, message: "Phone number is required" });
    }
    // Call the service function, passing the authenticated user's id and the phone number
    const result = await whatsappService.checkWhatsAppNumber(
      req.user.id,
      phoneNumber
    );
    res.json(result);
  } catch (error) {
    console.error("Error checking WhatsApp number:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Failed to check WhatsApp number",
    });
  }
};
/**
 * 🔌 Disconnect the currently connected WhatsApp session.
 *
 * Accepts an optional `accountId` in the request body to target a
 * specific WhatsApp account (primary vs alternative).  Delegates the
 * actual disconnect call to the service layer and returns the
 * resulting response to the client.
 */
exports.disconnectWhatsApp = async (req, res) => {
  try {
    const { accountId } = req.body;
    const result = await whatsappService.disconnectFromWhatsApp(
      req.user.id,
      accountId
    );
    res.json(result);
  } catch (error) {
    console.error("Error disconnecting WhatsApp account:", error);
    res.status(400).json({ success: false, message: error.message });
  }
};
