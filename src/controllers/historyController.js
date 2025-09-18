const historyService = require("../services/historyService");

exports.getUserMessages = async (req, res) => {
  try {
    // Extract user ID from the request (set by authentication middleware)
    const userId = req.user.id;
    console.log("👤 User ID:", userId);

    // Forward query parameters and userId to the service
    const data = await historyService.fetchUserMessages(userId, req.query);
    res.json(data);
  } catch (error) {
    console.error("Error in getUserMessages:", error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.getHistoryBetweenDates = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Validate pagination parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10)); // Max 100 items per page
    
    // Prepare query parameters with validated pagination
    const queryParams = {
      ...req.query,
      page,
      limit
    };
    
    // Expect query parameters: startDate, endDate, page, limit
    const data = await historyService.fetchHistoryBetweenDates(
      userId,
      queryParams
    );
    res.json(data);
  } catch (error) {
    console.error("Error in getHistoryBetweenDates:", error.message);
    res.status(500).json({ error: error.message });
  }
};

exports.getMessagesByHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const historyId = req.params.historyId;
    const buffer = await historyService.fetchMessagesByHistory(
      userId,
      historyId
    );

    res.set({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="report.xlsx"',
    });
    res.send(buffer);
  } catch (error) {
    console.error("Error in getMessagesByHistory:", error.message);
    res.status(500).json({ error: error.message });
  }
};
