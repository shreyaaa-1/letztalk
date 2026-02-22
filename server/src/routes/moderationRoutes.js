const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { reportUser } = require("../controllers/moderationController");

router.post("/report", protect, reportUser);

module.exports = router;