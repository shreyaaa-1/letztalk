const express = require("express");
const router = express.Router();
const { createGuestUser } = require("../controllers/authController");

router.post("/guest", createGuestUser);

module.exports = router;