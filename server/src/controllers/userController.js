// @desc    Get current user profile
// @route   GET /api/users/me
// @access  Private
const getMe = async (req, res) => {
  try {
    return res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    console.error("GetMe error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = { getMe };