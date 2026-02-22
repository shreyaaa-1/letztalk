const express = require("express");
const router = express.Router();

const {
  createGuestUser,
  registerUser,
  loginUser,
} = require("../controllers/authController");

// Guest login
router.post("/guest", createGuestUser);

// Register user
router.post("/register", registerUser);

// Login user
router.post("/login", loginUser);

module.exports = router;