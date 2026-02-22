const express = require("express");
const router = express.Router();
const { getQueueStats } = require("../services/matchService");

// basic health
router.get("/", (req, res) => {
  res.json({ status: "ok" });
});

// queue debug
router.get("/queue", (req, res) => {
  res.json({
    success: true,
    stats: getQueueStats(),
  });
});

module.exports = router;