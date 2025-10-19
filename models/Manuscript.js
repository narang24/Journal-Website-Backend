const mongoose = require('mongoose');

const manuscriptSchema = new mongoose.Schema({
  // Basic Information
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxLength: [200, 'Title cannot exceed 200 characters']
  },
  abstract: {
    type: String,
    required: [true, 'Abstract is required'],
    maxLength: [300, 'Abstract cannot exceed 300 words']
  },
  
  // Authors
  authors: [{
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    middleName: {
      type: String,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    affiliation: String,
    country: String,
    bioStatement: String,
    isPrincipal: {
      type: Boolean,
      default: false
    }
  }],
  
  // Keywords and Language
  keywords: [{
    type: String,
    trim: true
  }],
  language: {
    type: String,
    default: 'en',
    enum: ['en', 'fr', 'es', 'de', 'zh']
  },
  
  // References
  references: [{
    type: String,
    trim: true
  }],
  
  // Files
  manuscriptFile: {
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true,
      enum: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/rtf',
        'text/rtf'
      ]
    },
    size: {
      type: Number,
      required: true,
      max: [20 * 1024 * 1024, 'File size cannot exceed 20MB'] // 20MB
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    pageCount: {
      type: Number,
      min: [8, 'Manuscript must be at least 8 pages'],
      max: [12, 'Manuscript cannot exceed 12 pages']
    }
  },
  
  supplementaryFiles: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Validation Checklist
  validationChecklist: {
    originalWork: {
      type: Boolean,
      required: true
    },
    correctFormat: {
      type: Boolean,
      required: true
    },
    referencesValid: {
      type: Boolean,
      required: true
    },
    properFormatting: {
      type: Boolean,
      required: true
    },
    followsGuidelines: {
      type: Boolean,
      required: true
    },
    blindReviewReady: {
      type: Boolean,
      required: true
    }
  },
  
  // Copyright Agreement
  copyrightAgreed: {
    type: Boolean,
    required: true
  },
  copyrightAgreedDate: {
    type: Date,
    default: Date.now
  },
  
  // Status and Tracking
  status: {
    type: String,
    enum: [
      'draft',
      'validation_pending',
      'validation_failed',
      'submitted',
      'under_review',
      'revision_required',
      'accepted',
      'rejected',
      'published'
    ],
    default: 'validation_pending'
  },
  
  validationErrors: [{
    field: String,
    message: String,
    severity: {
      type: String,
      enum: ['error', 'warning'],
      default: 'error'
    }
  }],
  
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  submittedDate: {
    type: Date,
    default: Date.now
  },
  
  // Comments
  commentsForEditor: {
    type: String,
    maxLength: [1000, 'Comments cannot exceed 1000 characters']
  },
  
  // Agencies and Support
  agencies: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Indexes
manuscriptSchema.index({ submittedBy: 1 });
manuscriptSchema.index({ status: 1 });
manuscriptSchema.index({ submittedDate: -1 });
manuscriptSchema.index({ 'authors.email': 1 });

// Pre-save validation
manuscriptSchema.pre('save', function(next) {
  // Ensure at least one author is marked as principal
  const hasPrincipal = this.authors.some(author => author.isPrincipal);
  if (!hasPrincipal && this.authors.length > 0) {
    this.authors[0].isPrincipal = true;
  }
  
  next();
});

// Instance method to validate manuscript
manuscriptSchema.methods.validateManuscript = function() {
  const errors = [];
  
  // Check title length (max 20 words as per IJESTY)
  const wordCount = this.title.trim().split(/\s+/).length;
  if (wordCount > 20) {
    errors.push({
      field: 'title',
      message: `Title exceeds 20 words (current: ${wordCount} words)`,
      severity: 'error'
    });
  }
  
  // Check abstract - REMOVED minimum word count requirement
  // Only check maximum word count (300 words)
  const abstractWordCount = this.abstract.trim().split(/\s+/).length;
  if (abstractWordCount > 300) {
    errors.push({
      field: 'abstract',
      message: `Abstract cannot exceed 300 words (current: ${abstractWordCount} words)`,
      severity: 'error'
    });
  }
  
  // REMOVED: Minimum references check (20 required)
  // References are now optional or can have any number
  
  // Check file format
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',
    'text/rtf'
  ];
  
  if (!allowedMimeTypes.includes(this.manuscriptFile.mimeType)) {
    errors.push({
      field: 'manuscriptFile',
      message: 'File must be in DOC, DOCX, PDF, or RTF format',
      severity: 'error'
    });
  }
  
  // Check page count (8-12 pages)
  if (this.manuscriptFile.pageCount) {
    if (this.manuscriptFile.pageCount < 8) {
      errors.push({
        field: 'manuscriptFile',
        message: `Manuscript must be at least 8 pages (current: ${this.manuscriptFile.pageCount} pages)`,
        severity: 'error'
      });
    } else if (this.manuscriptFile.pageCount > 12) {
      errors.push({
        field: 'manuscriptFile',
        message: `Manuscript exceeds 12 pages (current: ${this.manuscriptFile.pageCount} pages). Editor evaluation required.`,
        severity: 'warning'
      });
    }
  }
  
  // Check authors
  if (!this.authors || this.authors.length === 0) {
    errors.push({
      field: 'authors',
      message: 'At least one author is required',
      severity: 'error'
    });
  } else {
    // Check if principal contact is set
    const hasPrincipal = this.authors.some(author => author.isPrincipal);
    if (!hasPrincipal) {
      errors.push({
        field: 'authors',
        message: 'Principal contact for editorial correspondence must be designated',
        severity: 'error'
      });
    }
  }
  
  // Check validation checklist
  const requiredChecks = [
    'originalWork',
    'correctFormat',
    'referencesValid',
    'properFormatting',
    'followsGuidelines',
    'blindReviewReady'
  ];
  
  for (const check of requiredChecks) {
    if (!this.validationChecklist[check]) {
      errors.push({
        field: 'validationChecklist',
        message: `Required checklist item not confirmed: ${check}`,
        severity: 'error'
      });
    }
  }
  
  // Check copyright agreement
  if (!this.copyrightAgreed) {
    errors.push({
      field: 'copyright',
      message: 'Copyright notice must be acknowledged',
      severity: 'error'
    });
  }
  
  return errors;
};

// Static method to get validation requirements
manuscriptSchema.statics.getValidationRequirements = function() {
  return {
    title: {
      maxWords: 20,
      description: 'Title must not exceed 20 words'
    },
    abstract: {
      maxWords: 300,
      description: 'Abstract must not exceed 300 words'
    },
    pages: {
      min: 8,
      max: 12,
      description: 'Manuscript must be 8-12 pages'
    },
    references: {
      description: 'References are optional'
    },
    fileFormats: {
      allowed: ['DOC', 'DOCX', 'PDF', 'RTF'],
      maxSize: 20 * 1024 * 1024, // 20MB
      description: 'File must be DOC, DOCX, PDF, or RTF, max 20MB'
    }
  };
};

const Manuscript = mongoose.model('Manuscript', manuscriptSchema);

module.exports = Manuscript;