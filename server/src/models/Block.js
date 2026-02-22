const mongoose = require("mongoose");

const blockSchema = new mongoose.Schema(
  {
    blocker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blockedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    blockedSocketId: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Block", blockSchema);