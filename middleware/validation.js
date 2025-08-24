const validator = require('validator');

// Helper function to create validation error response
const createValidationError = (message, field = null) => {
  return {
    success: false,
    message,
    field,
    action: 'fix_input'
  };
};

// Validate registration data
const validateRegister = (req, res, next) => {
  try {
    const { fullName, email, password, confirmPassword, role, bio, expertise } = req.body;
    const errors = [];

    // Full Name validation
    if (!fullName || fullName.trim().length === 0) {
      errors.push({ field: 'fullName', message: 'Full name is required' });
    } else if (fullName.trim().length < 2) {
      errors.push({ field: 'fullName', message: 'Full name must be at least 2 characters long' });
    } else if (fullName.trim().length > 50) {
      errors.push({ field: 'fullName', message: 'Full name cannot exceed 50 characters' });
    } else if (!/^[a-zA-Z\s'-]+$/.test(fullName.trim())) {
      errors.push({ field: 'fullName', message: 'Full name can only contain letters, spaces, hyphens, and apostrophes' });
    }

    // Email validation
    if (!email || email.trim().length === 0) {
      errors.push({ field: 'email', message: 'Email address is required' });
    } else if (!validator.isEmail(email.trim())) {
      errors.push({ field: 'email', message: 'Please provide a valid email address' });
    } else if (email.trim().length > 100) {
      errors.push({ field: 'email', message: 'Email address is too long' });
    }

    // Password validation
    if (!password) {
      errors.push({ field: 'password', message: 'Password is required' });
    } else if (password.length < 8) {
      errors.push({ field: 'password', message: 'Password must be at least 8 characters long' });
    } else if (password.length > 128) {
      errors.push({ field: 'password', message: 'Password is too long (max 128 characters)' });
    } else {
      // Strong password validation
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
      if (!passwordRegex.test(password)) {
        errors.push({ 
          field: 'password', 
          message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)' 
        });
      }
    }

    // Confirm Password validation
    if (!confirmPassword) {
      errors.push({ field: 'confirmPassword', message: 'Please confirm your password' });
    } else if (password !== confirmPassword) {
      errors.push({ field: 'confirmPassword', message: 'Passwords do not match' });
    }

    // Role validation (optional)
    if (role && !['publisher', 'reviewer', 'admin'].includes(role)) {
      errors.push({ field: 'role', message: 'Invalid role. Must be publisher, reviewer, or admin' });
    }

    // Bio validation (optional)
    if (bio && bio.length > 500) {
      errors.push({ field: 'bio', message: 'Bio cannot exceed 500 characters' });
    }

    // Expertise validation (optional)
    if (expertise) {
      if (typeof expertise === 'string') {
        const expertiseArray = expertise.split(',').map(exp => exp.trim()).filter(exp => exp);
        if (expertiseArray.length > 10) {
          errors.push({ field: 'expertise', message: 'Cannot have more than 10 expertise areas' });
        }
        // Check each expertise item
        expertiseArray.forEach((exp, index) => {
          if (exp.length > 50) {
            errors.push({ field: 'expertise', message: `Expertise item ${index + 1} is too long (max 50 characters)` });
          }
        });
      } else if (Array.isArray(expertise)) {
        if (expertise.length > 10) {
          errors.push({ field: 'expertise', message: 'Cannot have more than 10 expertise areas' });
        }
        expertise.forEach((exp, index) => {
          if (typeof exp !== 'string' || exp.trim().length === 0) {
            errors.push({ field: 'expertise', message: `Expertise item ${index + 1} is invalid` });
          } else if (exp.trim().length > 50) {
            errors.push({ field: 'expertise', message: `Expertise item ${index + 1} is too long (max 50 characters)` });
          }
        });
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please fix the following validation errors:',
        errors: errors,
        action: 'fix_input'
      });
    }

    // Sanitize and normalize data
    req.body.fullName = fullName.trim();
    req.body.email = email.trim().toLowerCase();
    req.body.bio = bio ? bio.trim() : '';
    
    next();

  } catch (error) {
    console.error('Registration validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during validation'
    });
  }
};

// Validate login data
const validateLogin = (req, res, next) => {
  try {
    const { email, password } = req.body;
    const errors = [];

    // Email validation
    if (!email || email.trim().length === 0) {
      errors.push({ field: 'email', message: 'Email address is required' });
    } else if (!validator.isEmail(email.trim())) {
      errors.push({ field: 'email', message: 'Please provide a valid email address' });
    }

    // Password validation
    if (!password || password.length === 0) {
      errors.push({ field: 'password', message: 'Password is required' });
    } else if (password.length < 6) {
      errors.push({ field: 'password', message: 'Password is too short' });
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please fix the following validation errors:',
        errors: errors,
        action: 'fix_input'
      });
    }

    // Normalize email
    req.body.email = email.trim().toLowerCase();

    next();

  } catch (error) {
    console.error('Login validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during validation'
    });
  }
};

// Validate email only (for forgot password, resend verification)
const validateEmail = (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || email.trim().length === 0) {
      return res.status(400).json(
        createValidationError('Email address is required', 'email')
      );
    }

    if (!validator.isEmail(email.trim())) {
      return res.status(400).json(
        createValidationError('Please provide a valid email address', 'email')
      );
    }

    // Normalize email
    req.body.email = email.trim().toLowerCase();

    next();

  } catch (error) {
    console.error('Email validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during validation'
    });
  }
};

// Validate password only (for password reset)
const validatePassword = (req, res, next) => {
  try {
    const { password, confirmPassword } = req.body;
    const errors = [];

    // Password validation
    if (!password) {
      errors.push({ field: 'password', message: 'New password is required' });
    } else if (password.length < 8) {
      errors.push({ field: 'password', message: 'Password must be at least 8 characters long' });
    } else if (password.length > 128) {
      errors.push({ field: 'password', message: 'Password is too long (max 128 characters)' });
    } else {
      // Strong password validation
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
      if (!passwordRegex.test(password)) {
        errors.push({ 
          field: 'password', 
          message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)' 
        });
      }
    }

    // Confirm Password validation
    if (!confirmPassword) {
      errors.push({ field: 'confirmPassword', message: 'Please confirm your new password' });
    } else if (password !== confirmPassword) {
      errors.push({ field: 'confirmPassword', message: 'Passwords do not match' });
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please fix the following validation errors:',
        errors: errors,
        action: 'fix_input'
      });
    }

    next();

  } catch (error) {
    console.error('Password validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during validation'
    });
  }
};

// Validate profile update data
const validateUpdateProfile = (req, res, next) => {
  try {
    const { fullName, bio, expertise } = req.body;
    const errors = [];

    // Full Name validation (optional)
    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || fullName.trim().length === 0) {
        errors.push({ field: 'fullName', message: 'Full name cannot be empty' });
      } else if (fullName.trim().length < 2) {
        errors.push({ field: 'fullName', message: 'Full name must be at least 2 characters long' });
      } else if (fullName.trim().length > 50) {
        errors.push({ field: 'fullName', message: 'Full name cannot exceed 50 characters' });
      } else if (!/^[a-zA-Z\s'-]+$/.test(fullName.trim())) {
        errors.push({ field: 'fullName', message: 'Full name can only contain letters, spaces, hyphens, and apostrophes' });
      }
    }

    // Bio validation (optional)
    if (bio !== undefined && bio !== null) {
      if (typeof bio !== 'string') {
        errors.push({ field: 'bio', message: 'Bio must be a string' });
      } else if (bio.length > 500) {
        errors.push({ field: 'bio', message: 'Bio cannot exceed 500 characters' });
      }
    }

    // Expertise validation (optional)
    if (expertise !== undefined && expertise !== null) {
      if (typeof expertise === 'string') {
        const expertiseArray = expertise.split(',').map(exp => exp.trim()).filter(exp => exp);
        if (expertiseArray.length > 10) {
          errors.push({ field: 'expertise', message: 'Cannot have more than 10 expertise areas' });
        }
        // Check each expertise item
        expertiseArray.forEach((exp, index) => {
          if (exp.length > 50) {
            errors.push({ field: 'expertise', message: `Expertise item ${index + 1} is too long (max 50 characters)` });
          }
        });
      } else if (Array.isArray(expertise)) {
        if (expertise.length > 10) {
          errors.push({ field: 'expertise', message: 'Cannot have more than 10 expertise areas' });
        }
        expertise.forEach((exp, index) => {
          if (typeof exp !== 'string' || exp.trim().length === 0) {
            errors.push({ field: 'expertise', message: `Expertise item ${index + 1} is invalid` });
          } else if (exp.trim().length > 50) {
            errors.push({ field: 'expertise', message: `Expertise item ${index + 1} is too long (max 50 characters)` });
          }
        });
      } else {
        errors.push({ field: 'expertise', message: 'Expertise must be a string or array' });
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please fix the following validation errors:',
        errors: errors,
        action: 'fix_input'
      });
    }

    // Sanitize data if provided
    if (fullName !== undefined) req.body.fullName = fullName.trim();
    if (bio !== undefined) req.body.bio = bio.trim();

    next();

  } catch (error) {
    console.error('Profile update validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during validation'
    });
  }
};

// Generic sanitization helper
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim();
  }
  return input;
};

// Validate common request parameters
const validateParams = (paramName, type = 'string', required = true) => {
  return (req, res, next) => {
    try {
      const value = req.params[paramName];

      if (required && (!value || value.trim().length === 0)) {
        return res.status(400).json({
          success: false,
          message: `${paramName} parameter is required`,
          field: paramName
        });
      }

      if (value && type === 'objectId') {
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(value)) {
          return res.status(400).json({
            success: false,
            message: `Invalid ${paramName} format`,
            field: paramName
          });
        }
      }

      next();

    } catch (error) {
      console.error(`Parameter validation error for ${paramName}:`, error);
      res.status(500).json({
        success: false,
        message: 'Server error during parameter validation'
      });
    }
  };
};

module.exports = {
  validateRegister,
  validateLogin,
  validateEmail,
  validatePassword,
  validateUpdateProfile,
  validateParams,
  sanitizeInput
};