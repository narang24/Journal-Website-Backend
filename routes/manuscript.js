const express = require('express');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/manuscripts
// @desc    Get manuscripts (based on user role)
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Mock data for now - replace with actual database queries
    const mockManuscripts = [
      {
        id: 1,
        title: 'Advanced React Patterns in Modern Web Development',
        abstract: 'This paper explores advanced React patterns...',
        status: req.user.role === 'publisher' ? 'published' : 'pending_review',
        submittedDate: '2024-01-15',
        authors: ['John Doe', 'Jane Smith'],
        keywords: ['React', 'Web Development', 'JavaScript'],
        category: 'Computer Science'
      },
      {
        id: 2,
        title: 'Machine Learning Applications in Healthcare',
        abstract: 'A comprehensive study on ML applications...',
        status: req.user.role === 'publisher' ? 'under_review' : 'assigned',
        submittedDate: '2024-01-20',
        authors: ['Alice Johnson'],
        keywords: ['Machine Learning', 'Healthcare', 'AI'],
        category: 'Medical Sciences'
      }
    ];

    res.status(200).json({
      success: true,
      manuscripts: mockManuscripts
    });

  } catch (error) {
    console.error('Get manuscripts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching manuscripts.'
    });
  }
});

// @route   POST /api/manuscripts
// @desc    Submit new manuscript
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const manuscriptData = req.body;
    
    // Mock response for now - replace with actual database insertion
    const mockResponse = {
      success: true,
      manuscriptId: Date.now(),
      message: 'Manuscript submitted successfully!'
    };

    res.status(201).json(mockResponse);

  } catch (error) {
    console.error('Submit manuscript error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while submitting manuscript.'
    });
  }
});

module.exports = router;