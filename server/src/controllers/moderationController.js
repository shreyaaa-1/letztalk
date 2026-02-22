const Report = require("../models/Report");

// ===============================
// Report user
// ===============================
const reportUser = async (req, res) => {
  try {
    const { reportedUserId, reason, roomId } = req.body;

    if (!reportedUserId) {
      return res.status(400).json({
        success: false,
        message: "reportedUserId is required",
      });
    }

    const report = await Report.create({
      reporter: req.user._id,
      reportedUser: reportedUserId,
      reason: reason || "inappropriate_behavior",
      roomId,
    });

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