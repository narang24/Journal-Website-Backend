const express = require('express');
const User = require('../models/User');
const { authenticateToken, requireOwnershipOrAdmin } = require('../middleware/auth');
const { validateUpdateProfile } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/user/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile.'
    });
  }
});

// @route   PUT /api/user/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authenticateToken, validateUpdateProfile, async (req, res) => {
  try {
    const { fullName, bio, expertise } = req.body;
    const user = req.user;

    // Update fields if provided
    if (fullName !== undefined) user.fullName = fullName;
    if (bio !== undefined) user.bio = bio;
    if (expertise !== undefined) {
      user.expertise = expertise ? 
        expertise.split(',').map(exp => exp.trim()).filter(exp => exp) : 
        [];
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully!',
      user: user
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating profile.'
    });
  }
});

// @route   GET /api/user/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // This is a placeholder - you'll need to implement based on your manuscript model
    const stats = {
      totalManuscripts: 0,
      publishedManuscripts: 0,
      underReview: 0,
      totalReviews: 0,
      completedReviews: 0,
      pendingReviews: 0
    };

    res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics.'
    });
  }
});

module.exports = router;