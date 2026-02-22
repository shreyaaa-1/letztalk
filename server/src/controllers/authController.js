const User = require("../models/User");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");

// @desc    Create guest user
// @route   POST /api/auth/guest
const createGuestUser = async (req, res) => {
  try {
    const guestUser = await User.create({
      username: `guest_${uuidv4().slice(0, 6)}`,
      isGuest: true,
    });

    return res.status(201).json({
      success: true,
      user: guestUser,
    });
  } catch (error) {
    console.error("Guest creation error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Register user
// @route   POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // ✅ validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    // ✅ check existing
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

   // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

      const user = await User.create({
        username,
        email,
        password: hashedPassword,
        isGuest: false,
      });

    return res.status(201).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createGuestUser,
  registerUser,
};