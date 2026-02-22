const User = require("../models/User");
const { v4: uuidv4 } = require("uuid");

// @desc    Create guest user
// @route   POST /api/auth/guest
const createGuestUser = async (req, res) => {
  try {
    const guestUser = await User.create({
      username: `guest_${uuidv4().slice(0, 6)}`,
      isGuest: true,
    });

    res.status(201).json({
      success: true,
      user: guestUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { createGuestUser };