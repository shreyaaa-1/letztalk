const Report = require("../models/Report");

// ===============================
// Report user
// ===============================
const reportUser = async (req, res) => {
  try {
    const { reportedUserId, reportedSocketId, reason, roomId } = req.body;

    if (!reportedUserId && !reportedSocketId) {
      return res.status(400).json({
        success: false,
        message: "reportedUserId or reportedSocketId is required",
      });
    }

    const payload = {
      reporter: req.user._id,
      reason: reason || "inappropriate_behavior",
      roomId,
    };

    if (reportedUserId) {
      payload.reportedUser = reportedUserId;
    }

    if (reportedSocketId) {
      payload.reportedSocketId = reportedSocketId;
    }

    const report = await Report.create(payload);

    return res.status(201).json({
      success: true,
      report,
    });
  } catch (error) {
    console.error("Report error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { reportUser };