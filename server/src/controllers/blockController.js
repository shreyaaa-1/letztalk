const Block = require("../models/Block");

// ===============================
// Block user
// ===============================
const blockUser = async (req, res) => {
  try {
    const { blockedUserId, blockedSocketId } = req.body;

    if (!blockedUserId && !blockedSocketId) {
      return res.status(400).json({
        success: false,
        message: "blockedUserId or blockedSocketId is required",
      });
    }

    const payload = {
      blocker: req.user._id,
    };

    if (blockedUserId) {
      payload.blockedUser = blockedUserId;
    }

    if (blockedSocketId) {
      payload.blockedSocketId = blockedSocketId;
    }

    const block = await Block.create(payload);

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