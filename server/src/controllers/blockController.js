const Block = require("../models/Block");

// ===============================
// Block user
// ===============================
const blockUser = async (req, res) => {
  try {
    const { blockedUserId } = req.body;

    if (!blockedUserId) {
      return res.status(400).json({
        success: false,
        message: "blockedUserId is required",
      });
    }

    const block = await Block.create({
      blocker: req.user._id,
      blockedUser: blockedUserId,
    });

    return res.status(201).json({
      success: true,
      block,
    });
  } catch (error) {
    console.error("Block error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { blockUser };