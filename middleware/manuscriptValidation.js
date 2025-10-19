const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Validate file format
const validateFileFormat = (req, res, next) => {
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/rtf',
    'text/rtf'
  ];

  const allowedExtensions = ['.pdf', '.doc', '.docx', '.rtf'];

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded',
      errors: [{
        field: 'file',
        message: 'Manuscript file is required'
      }]
    });
  }

  const { mimetype, originalname } = req.file;
  const fileExtension = originalname.substring(originalname.lastIndexOf('.')).toLowerCase();

  if (!allowedMimeTypes.includes(mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file format',
      errors: [{
        field: 'file',
        message: 'File must be in DOC, DOCX, PDF, or RTF format'
      }]
    });
  }

  if (!allowedExtensions.includes(fileExtension)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file extension',
      errors: [{
        field: 'file',
        message: `File extension must be one of: ${allowedExtensions.join(', ')}`
      }]
    });
  }

  next();
};

// Validate file size
const validateFileSize = (maxSize = 20 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds limit',
        errors: [{
          field: 'file',
          message: `File size must not exceed ${maxSize / (1024 * 1024)}MB (current: ${(req.file.size / (1024 * 1024)).toFixed(2)}MB)`
        }]
      });
    }

    next();
  };
};

// Extract and validate page count from PDF
const extractPdfPageCount = async (buffer) => {
  try {
    const data = await pdfParse(buffer);
    return data.numpages;
  } catch (error) {
    console.error('Error extracting PDF page count:', error);
    return null;
  }
};

// Estimate page count from DOCX
const estimateDocxPageCount = async (buffer) => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value;
    
    // Rough estimation: 500 words per page
    const wordCount = text.split(/\s+/).length;
    const estimatedPages = Math.ceil(wordCount / 500);
    
    return estimatedPages;
  } catch (error) {
    console.error('Error estimating DOCX page count:', error);
    return null;
  }
};

// Validate page count
const validatePageCount = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    let pageCount = null;

    if (req.file.mimetype === 'application/pdf') {
      pageCount = await extractPdfPageCount(req.file.buffer);
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      pageCount = await estimateDocxPageCount(req.file.buffer);
    }

    if (pageCount !== null) {
      req.filePageCount = pageCount;

      const errors = [];

      if (pageCount < 8) {
        errors.push({
          field: 'file',
          message: `Manuscript must be at least 8 pages (detected: ${pageCount} pages)`,
          severity: 'error'
        });
      }

      if (pageCount > 12) {
        errors.push({
          field: 'file',
          message: `Manuscript exceeds 12 pages (detected: ${pageCount} pages). This will require editor evaluation.`,
          severity: 'warning'
        });
      }

      if (errors.some(e => e.severity === 'error')) {
        return res.status(400).json({
          success: false,
          message: 'Manuscript page count validation failed',
          errors
        });
      }

      // Store warnings for later
      req.pageCountWarnings = errors.filter(e => e.severity === 'warning');
    }

    next();
  } catch (error) {
    console.error('Error validating page count:', error);
    // Don't fail the request if page count extraction fails
    next();
  }
};

// Validate manuscript metadata
const validateManuscriptMetadata = (req, res, next) => {
  const errors = [];
  const { title, abstract, authors, references, keywords } = req.body;

  // Validate title
  if (!title || title.trim().length === 0) {
    errors.push({
      field: 'title',
      message: 'Title is required'
    });
  } else {
    const wordCount = title.trim().split(/\s+/).length;
    if (wordCount > 20) {
      errors.push({
        field: 'title',
        message: `Title exceeds 20 words (current: ${wordCount} words)`
      });
    }
  }

  // Validate abstract - REMOVED MINIMUM WORD COUNT CHECK
  // Only check if abstract exists and doesn't exceed max words
  if (!abstract || abstract.trim().length === 0) {
    errors.push({
      field: 'abstract',
      message: 'Abstract is required'
    });
  } else {
    const wordCount = abstract.trim().split(/\s+/).length;
    if (wordCount > 300) {
      errors.push({
        field: 'abstract',
        message: `Abstract cannot exceed 300 words (current: ${wordCount} words)`
      });
    }
  }

  // Validate authors
  if (!authors || authors.length === 0) {
    errors.push({
      field: 'authors',
      message: 'At least one author is required'
    });
  } else {
    // Check if each author has required fields
    authors.forEach((author, index) => {
      if (!author.firstName || !author.lastName || !author.email) {
        errors.push({
          field: `authors[${index}]`,
          message: `Author ${index + 1} must have first name, last name, and email`
        });
      }
    });

    // Check if principal contact is set
    const hasPrincipal = authors.some(author => author.isPrincipal);
    if (!hasPrincipal) {
      errors.push({
        field: 'authors',
        message: 'Principal contact for editorial correspondence must be designated'
      });
    }
  }

  // REMOVED: Minimum references check (20 required)
  // References validation is now removed - they are optional

  // Validate keywords (optional but recommended)
  if (!keywords || keywords.length === 0) {
    errors.push({
      field: 'keywords',
      message: 'Keywords are recommended for better indexing',
      severity: 'warning'
    });
  }

  if (errors.some(e => !e.severity || e.severity === 'error')) {
    return res.status(400).json({
      success: false,
      message: 'Manuscript metadata validation failed',
      errors
    });
  }

  // Store warnings
  req.metadataWarnings = errors.filter(e => e.severity === 'warning');

  next();
};

// Validate submission checklist
const validateSubmissionChecklist = (req, res, next) => {
  const errors = [];
  const { validationChecklist, copyrightAgreed } = req.body;

  if (!validationChecklist) {
    return res.status(400).json({
      success: false,
      message: 'Validation checklist is required',
      errors: [{
        field: 'validationChecklist',
        message: 'You must complete the submission checklist'
      }]
    });
  }

  const requiredChecks = [
    'originalWork',
    'correctFormat',
    'referencesValid',
    'properFormatting',
    'followsGuidelines',
    'blindReviewReady'
  ];

  for (const check of requiredChecks) {
    if (!validationChecklist[check]) {
      errors.push({
        field: 'validationChecklist',
        message: `Required checklist item not confirmed: ${check.replace(/([A-Z])/g, ' $1').toLowerCase()}`
      });
    }
  }

  if (!copyrightAgreed) {
    errors.push({
      field: 'copyright',
      message: 'You must acknowledge the copyright notice to submit'
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Submission checklist validation failed',
      errors
    });
  }

  next();
};

// Comprehensive manuscript validation
const validateCompleteManuscript = [
  validateFileFormat,
  validateFileSize(20 * 1024 * 1024),
  validatePageCount,
  validateManuscriptMetadata,
  validateSubmissionChecklist
];

// Get validation requirements (for frontend)
const getValidationRequirements = (req, res) => {
  res.status(200).json({
    success: true,
    requirements: {
      title: {
        maxWords: 20,
        description: 'Maximum 20 words, without acronym or abbreviation'
      },
      abstract: {
        maxWords: 300,
        description: 'Maximum 300 words with no citations'
      },
      manuscript: {
        minPages: 8,
        maxPages: 12,
        description: 'Minimum 8 pages, maximum 12 pages (editors evaluate if more needed)',
        allowedFormats: ['DOC', 'DOCX', 'PDF', 'RTF'],
        maxSize: '20MB'
      },
      references: {
        description: 'References are optional'
      },
      authors: {
        minimum: 1,
        requiredFields: ['firstName', 'lastName', 'email'],
        principalContactRequired: true,
        description: 'At least one author required with principal contact designated'
      },
      checklist: {
        required: [
          'originalWork',
          'correctFormat',
          'referencesValid',
          'properFormatting',
          'followsGuidelines',
          'blindReviewReady'
        ],
        description: 'All checklist items must be confirmed'
      },
      copyright: {
        required: true,
        description: 'Copyright notice must be acknowledged'
      }
    }
  });
};

module.exports = {
  validateFileFormat,
  validateFileSize,
  validatePageCount,
  validateManuscriptMetadata,
  validateSubmissionChecklist,
  validateCompleteManuscript,
  getValidationRequirements
};