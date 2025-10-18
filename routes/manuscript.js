const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Manuscript = require('../models/Manuscript');
const { authenticateToken, requireRole } = require('../middleware/auth');
const {
  validateCompleteManuscript,
  getValidationRequirements
} = require('../middleware/manuscriptValidation');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/rtf',
      'text/rtf'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and RTF files are allowed.'));
    }
  }
});

// @route   GET /api/manuscripts/validation-requirements
// @desc    Get validation requirements for manuscripts
// @access  Public
router.get('/validation-requirements', getValidationRequirements);

// @route   POST /api/manuscripts
// @desc    Submit a new manuscript
// @access  Private
router.post(
  '/',
  authenticateToken,
  upload.fields([
    { name: 'manuscriptFile', maxCount: 1 },
    { name: 'supplementaryFiles', maxCount: 10 }
  ]),
  async (req, res) => {
    try {
      // Parse the data from form data
      const data = JSON.parse(req.body.data);
      
      // Get uploaded files
      const manuscriptFile = req.files['manuscriptFile'] ? req.files['manuscriptFile'][0] : null;
      const supplementaryFiles = req.files['supplementaryFiles'] || [];

      if (!manuscriptFile) {
        return res.status(400).json({
          success: false,
          message: 'Manuscript file is required',
          errors: [{ field: 'manuscriptFile', message: 'Please upload your manuscript file' }]
        });
      }

      // Create manuscript object
      const manuscript = new Manuscript({
        title: data.title,
        abstract: data.abstract,
        authors: data.authors,
        keywords: data.keywords || [],
        language: data.language || 'en',
        references: data.references || [],
        agencies: data.agencies || [],
        manuscriptFile: {
          filename: `manuscript_${Date.now()}${path.extname(manuscriptFile.originalname)}`,
          originalName: manuscriptFile.originalname,
          mimeType: manuscriptFile.mimetype,
          size: manuscriptFile.size,
          buffer: manuscriptFile.buffer
        },
        supplementaryFiles: supplementaryFiles.map(file => ({
          filename: `supp_${Date.now()}_${file.originalname}`,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          buffer: file.buffer
        })),
        validationChecklist: data.validationChecklist,
        copyrightAgreed: data.copyrightAgreed,
        copyrightAgreedDate: new Date(),
        commentsForEditor: data.commentsForEditor || '',
        submittedBy: req.user._id,
        status: 'validation_pending'
      });

      // Validate the manuscript
      const validationErrors = manuscript.validateManuscript();
      
      if (validationErrors.some(error => error.severity === 'error')) {
        manuscript.status = 'validation_failed';
        manuscript.validationErrors = validationErrors;
        await manuscript.save();

        return res.status(400).json({
          success: false,
          message: 'Manuscript validation failed',
          errors: validationErrors.filter(e => e.severity === 'error'),
          warnings: validationErrors.filter(e => e.severity === 'warning'),
          manuscriptId: manuscript._id
        });
      }

      // If only warnings, still save as submitted
      manuscript.status = 'submitted';
      manuscript.validationErrors = validationErrors;
      
      // Save the manuscript
      await manuscript.save();

      // TODO: Send confirmation email to principal author
      const principalAuthor = manuscript.authors.find(a => a.isPrincipal);
      
      res.status(201).json({
        success: true,
        message: 'Manuscript submitted successfully!',
        manuscript: {
          id: manuscript._id,
          title: manuscript.title,
          status: manuscript.status,
          submittedDate: manuscript.submittedDate,
          principalAuthor: principalAuthor ? `${principalAuthor.firstName} ${principalAuthor.lastName}` : ''
        },
        warnings: validationErrors.filter(e => e.severity === 'warning')
      });

    } catch (error) {
      console.error('Manuscript submission error:', error);
      
      if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }));
        
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error during manuscript submission',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   GET /api/manuscripts
// @desc    Get user's manuscripts
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    
    const query = { submittedBy: req.user._id };
    if (status) {
      query.status = status;
    }

    const manuscripts = await Manuscript.find(query)
      .select('-manuscriptFile.buffer -supplementaryFiles.buffer')
      .sort({ submittedDate: -1 });

    res.status(200).json({
      success: true,
      count: manuscripts.length,
      manuscripts
    });

  } catch (error) {
    console.error('Get manuscripts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching manuscripts'
    });
  }
});

// @route   GET /api/manuscripts/:id
// @desc    Get manuscript by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const manuscript = await Manuscript.findById(req.params.id)
      .select('-manuscriptFile.buffer -supplementaryFiles.buffer');

    if (!manuscript) {
      return res.status(404).json({
        success: false,
        message: 'Manuscript not found'
      });
    }

    // Check if user owns this manuscript or is admin/reviewer
    if (
      manuscript.submittedBy.toString() !== req.user._id.toString() &&
      !['admin', 'reviewer'].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      manuscript
    });

  } catch (error) {
    console.error('Get manuscript error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching manuscript'
    });
  }
});

// @route   PUT /api/manuscripts/:id
// @desc    Update manuscript (for revisions)
// @access  Private
router.put(
  '/:id',
  authenticateToken,
  upload.fields([
    { name: 'manuscriptFile', maxCount: 1 },
    { name: 'supplementaryFiles', maxCount: 10 }
  ]),
  async (req, res) => {
    try {
      const manuscript = await Manuscript.findById(req.params.id);

      if (!manuscript) {
        return res.status(404).json({
          success: false,
          message: 'Manuscript not found'
        });
      }

      // Check ownership
      if (manuscript.submittedBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Only allow updates for drafts or revision-required manuscripts
      if (!['draft', 'revision_required'].includes(manuscript.status)) {
        return res.status(400).json({
          success: false,
          message: 'This manuscript cannot be edited in its current status'
        });
      }

      // Parse updated data
      const data = JSON.parse(req.body.data);

      // Update fields
      if (data.title) manuscript.title = data.title;
      if (data.abstract) manuscript.abstract = data.abstract;
      if (data.authors) manuscript.authors = data.authors;
      if (data.keywords) manuscript.keywords = data.keywords;
      if (data.language) manuscript.language = data.language;
      if (data.references) manuscript.references = data.references;
      if (data.agencies) manuscript.agencies = data.agencies;
      if (data.commentsForEditor) manuscript.commentsForEditor = data.commentsForEditor;

      // Update manuscript file if provided
      if (req.files['manuscriptFile']) {
        const manuscriptFile = req.files['manuscriptFile'][0];
        manuscript.manuscriptFile = {
          filename: `manuscript_${Date.now()}${path.extname(manuscriptFile.originalname)}`,
          originalName: manuscriptFile.originalname,
          mimeType: manuscriptFile.mimetype,
          size: manuscriptFile.size,
          buffer: manuscriptFile.buffer
        };
      }

      // Add new supplementary files
      if (req.files['supplementaryFiles']) {
        const newSupplementaryFiles = req.files['supplementaryFiles'].map(file => ({
          filename: `supp_${Date.now()}_${file.originalname}`,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          buffer: file.buffer
        }));
        manuscript.supplementaryFiles.push(...newSupplementaryFiles);
      }

      // Revalidate
      const validationErrors = manuscript.validateManuscript();
      manuscript.validationErrors = validationErrors;

      if (validationErrors.some(error => error.severity === 'error')) {
        manuscript.status = 'validation_failed';
      } else {
        manuscript.status = 'submitted';
      }

      await manuscript.save();

      res.status(200).json({
        success: true,
        message: 'Manuscript updated successfully',
        manuscript: {
          id: manuscript._id,
          title: manuscript.title,
          status: manuscript.status
        },
        warnings: validationErrors.filter(e => e.severity === 'warning')
      });

    } catch (error) {
      console.error('Update manuscript error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error while updating manuscript'
      });
    }
  }
);

// @route   DELETE /api/manuscripts/:id
// @desc    Delete manuscript (only drafts)
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const manuscript = await Manuscript.findById(req.params.id);

    if (!manuscript) {
      return res.status(404).json({
        success: false,
        message: 'Manuscript not found'
      });
    }

    // Check ownership
    if (manuscript.submittedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow deletion of drafts
    if (manuscript.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft manuscripts can be deleted'
      });
    }

    await manuscript.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Manuscript deleted successfully'
    });

  } catch (error) {
    console.error('Delete manuscript error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting manuscript'
    });
  }
});

// @route   GET /api/manuscripts/:id/download
// @desc    Download manuscript file
// @access  Private
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const manuscript = await Manuscript.findById(req.params.id);

    if (!manuscript) {
      return res.status(404).json({
        success: false,
        message: 'Manuscript not found'
      });
    }

    // Check access permissions
    if (
      manuscript.submittedBy.toString() !== req.user._id.toString() &&
      !['admin', 'reviewer'].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!manuscript.manuscriptFile || !manuscript.manuscriptFile.buffer) {
      return res.status(404).json({
        success: false,
        message: 'Manuscript file not found'
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', manuscript.manuscriptFile.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${manuscript.manuscriptFile.originalName}"`
    );
    res.setHeader('Content-Length', manuscript.manuscriptFile.size);

    // Send file buffer
    res.send(manuscript.manuscriptFile.buffer);

  } catch (error) {
    console.error('Download manuscript error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while downloading manuscript'
    });
  }
});

// @route   POST /api/manuscripts/validate
// @desc    Validate manuscript without submitting
// @access  Private
router.post(
  '/validate',
  authenticateToken,
  upload.single('manuscriptFile'),
  async (req, res) => {
    try {
      const data = JSON.parse(req.body.data);
      const file = req.file;

      // Create temporary manuscript for validation only
      const tempManuscript = new Manuscript({
        title: data.title,
        abstract: data.abstract,
        authors: data.authors,
        references: data.references || [],
        manuscriptFile: file ? {
          filename: file.originalname,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size
        } : null,
        validationChecklist: data.validationChecklist || {},
        copyrightAgreed: data.copyrightAgreed || false,
        submittedBy: req.user._id
      });

      // Validate without saving
      const validationErrors = tempManuscript.validateManuscript();

      const hasErrors = validationErrors.some(e => e.severity === 'error');
      const hasWarnings = validationErrors.some(e => e.severity === 'warning');

      res.status(200).json({
        success: !hasErrors,
        message: hasErrors 
          ? 'Validation failed. Please fix the errors.' 
          : hasWarnings 
          ? 'Validation passed with warnings.'
          : 'Validation passed successfully!',
        isValid: !hasErrors,
        errors: validationErrors.filter(e => e.severity === 'error'),
        warnings: validationErrors.filter(e => e.severity === 'warning')
      });

    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({
        success: false,
        message: 'Server error during validation'
      });
    }
  }
);

// @route   GET /api/manuscripts/stats/summary
// @desc    Get manuscript statistics for current user
// @access  Private
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const stats = {
      total: await Manuscript.countDocuments({ submittedBy: req.user._id }),
      draft: await Manuscript.countDocuments({ submittedBy: req.user._id, status: 'draft' }),
      submitted: await Manuscript.countDocuments({ submittedBy: req.user._id, status: 'submitted' }),
      underReview: await Manuscript.countDocuments({ submittedBy: req.user._id, status: 'under_review' }),
      revisionRequired: await Manuscript.countDocuments({ submittedBy: req.user._id, status: 'revision_required' }),
      accepted: await Manuscript.countDocuments({ submittedBy: req.user._id, status: 'accepted' }),
      rejected: await Manuscript.countDocuments({ submittedBy: req.user._id, status: 'rejected' }),
      published: await Manuscript.countDocuments({ submittedBy: req.user._id, status: 'published' })
    };

    res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics'
    });
  }
});

// Admin/Reviewer routes

// @route   GET /api/manuscripts/admin/all
// @desc    Get all manuscripts (admin/reviewer only)
// @access  Private (Admin/Reviewer)
router.get('/admin/all', authenticateToken, requireRole('admin', 'reviewer'), async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = status ? { status } : {};
    const skip = (page - 1) * limit;

    const manuscripts = await Manuscript.find(query)
      .select('-manuscriptFile.buffer -supplementaryFiles.buffer')
      .populate('submittedBy', 'fullName email')
      .sort({ submittedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Manuscript.countDocuments(query);

    res.status(200).json({
      success: true,
      count: manuscripts.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      manuscripts
    });

  } catch (error) {
    console.error('Get all manuscripts error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching manuscripts'
    });
  }
});

// @route   PATCH /api/manuscripts/:id/status
// @desc    Update manuscript status (admin/reviewer only)
// @access  Private (Admin/Reviewer)
router.patch('/:id/status', authenticateToken, requireRole('admin', 'reviewer'), async (req, res) => {
  try {
    const { status, comments } = req.body;

    const validStatuses = [
      'draft',
      'validation_pending',
      'validation_failed',
      'submitted',
      'under_review',
      'revision_required',
      'accepted',
      'rejected',
      'published'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const manuscript = await Manuscript.findById(req.params.id);

    if (!manuscript) {
      return res.status(404).json({
        success: false,
        message: 'Manuscript not found'
      });
    }

    manuscript.status = status;
    if (comments) {
      manuscript.commentsForEditor = comments;
    }

    await manuscript.save();

    // TODO: Send notification email to author

    res.status(200).json({
      success: true,
      message: 'Manuscript status updated successfully',
      manuscript: {
        id: manuscript._id,
        title: manuscript.title,
        status: manuscript.status
      }
    });

  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating status'
    });
  }
});

module.exports = router;