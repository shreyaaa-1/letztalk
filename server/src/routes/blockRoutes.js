const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { blockUser } = require("../controllers/blockController");

router.post("/block", protect, blockUser);

module.exports = router;