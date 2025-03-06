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
    // Expect query parameters: startDate, endDate
    const data = await historyService.fetchHistoryBetweenDates(
      userId,
      req.query
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
