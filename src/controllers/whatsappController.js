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
    console.error("❌ WhatsApp Controller - Error fetching WhatsApp account info:", error);
    res.status(500).json({ 
      error: "WhatsApp Account Info Controller Error",
      message: error.message || "Failed to fetch WhatsApp account info",
      source: "WhatsApp Controller"
    });
  }
};

// ✅ Get API Key by Business ID
exports.getApiKeyByBusinessId = async (req, res) => {
  try {
    const businessId = req.params.businessId;
    const apiKey = await whatsappService.getApiKeyByBusinessId(businessId);

    if (!apiKey) {
      return res
        .status(404)
        .json({ message: "API key not found for this business" });
    }

    res.json({ apiKey });
  } catch (error) {
    console.error("❌ WhatsApp Controller - Error fetching API key by business ID:", error);
    res.status(500).json({ 
      error: "API Key Fetch Controller Error",
      message: error.message || "Failed to fetch API key",
      source: "WhatsApp Controller"
    });
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
    console.error("❌ WhatsApp Controller - API Key Reset Error:", error);
    res.status(400).json({ 
      error: "API Key Reset Controller Error",
      message: error.message || "Failed to reset API key",
      source: "WhatsApp Controller"
    });
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
    console.error("❌ WhatsApp Controller - API Key Update Error:", error);
    res.status(400).json({ 
      error: "API Key Update Controller Error",
      message: error.message || "Failed to update API key",
      source: "WhatsApp Controller"
    });
  }
};
// ✅ Get WhatsApp Authentication Status
// ✅ Get WhatsApp Authentication Status
exports.getWhatsAppStatus = async (req, res) => {
  try {
    const status = await whatsappService.fetchWhatsAppStatus(req.user.id);
    res.json(status);
  } catch (error) {
    console.error("❌ WhatsApp Controller - Status Fetch Error:", error);
    res.status(400).json({ 
      error: "WhatsApp Status Controller Error",
      message: error.message || "Failed to fetch WhatsApp status",
      source: "WhatsApp Controller"
    });
  }
};

// ✅ Connect to WhatsApp (Retrieve QR Code)
exports.connectToWhatsApp = async (req, res) => {
  try {
    // Get account_id from query parameter or request body
    const accountId = req.query.account_id || req.body.accountId || req.body.account_id || null;
    const qrData = await whatsappService.connectToWhatsApp(req.user.id, accountId);
    res.json(qrData);
  } catch (error) {
    console.error("❌ WhatsApp Controller - Connect Error:", error);
    res.status(400).json({ 
      error: "WhatsApp Connect Controller Error",
      message: error.message || "Failed to connect to WhatsApp",
      source: "WhatsApp Controller"
    });
  }
};

// ✅ Get QR Code for WhatsApp connection
exports.getQRCode = async (req, res) => {
  try {
    const accountId = req.query.account_id || req.params.accountId;
    if (!accountId) {
      return res.status(400).json({
        error: "QR Code Controller Error",
        message: "Account ID is required",
        source: "WhatsApp Controller"
      });
    }

    const qrData = await whatsappService.getQRCode(req.user.id, accountId);
    res.json(qrData);
  } catch (error) {
    console.error("❌ WhatsApp Controller - QR Code Error:", error);
    res.status(400).json({
      error: "QR Code Controller Error",
      message: error.message || "Failed to get QR code",
      source: "WhatsApp Controller"
    });
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
    console.error("❌ WhatsApp Controller - Number Check Error:", error);
    res.status(400).json({
      success: false,
      error: "WhatsApp Number Check Controller Error",
      message: error.message || "Failed to check WhatsApp number",
      source: "WhatsApp Controller"
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
    console.error("❌ WhatsApp Controller - Disconnect Error:", error);
    res.status(400).json({ 
      success: false, 
      error: "WhatsApp Disconnect Controller Error",
      message: error.message || "Failed to disconnect WhatsApp account",
      source: "WhatsApp Controller"
    });
  }
};
