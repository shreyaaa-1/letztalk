const express = require("express");
const router = express.Router();

const {
  createGuestUser,
  registerUser,
} = require("../controllers/authController");

// Guest login
router.post("/guest", createGuestUser);

// Register user
router.post("/register", registerUser);

module.exports = router;