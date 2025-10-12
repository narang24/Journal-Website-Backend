const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('../utils/emailService');
const { authenticateToken } = require('../middleware/auth');
const { validateRegister, validateLogin, validateEmail, validatePassword } = require('../middleware/validation');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// @route   POST /api/auth/register
// @desc    Register a new user (sends verification email)
// @access  Public
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { fullName, email, password, role, bio, expertise } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      if (existingUser.isEmailVerified) {
        // User exists and is verified - redirect to login
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.',
          action: 'login',
          details: {
            email: existingUser.email,
            accountStatus: 'verified',
            suggestion: 'Please sign in with your existing account. If you forgot your password, use the "Forgot Password" option.'
          }
        });
      } else {
        // User exists but email not verified
        // Option 1: Update existing unverified account with new details (recommended)
        // Option 2: Just resend verification (current behavior)
        
        // Let's implement Option 1 - Update the existing unverified account
        existingUser.fullName = fullName;
        existingUser.password = password; // This will be hashed by the pre-save hook
        existingUser.role = role || 'publisher';
        existingUser.bio = bio || '';
        existingUser.expertise = expertise ? 
          expertise.split(',').map(exp => exp.trim()).filter(exp => exp) : 
          [];

        // Generate new verification token
        const verificationToken = generateVerificationToken();
        existingUser.emailVerificationToken = verificationToken;
        existingUser.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

        await existingUser.save();

        // Send verification email
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        await sendEmail({
          to: existingUser.email,
          subject: 'Complete Your Account Setup - Journal Platform',
          template: 'emailVerification', // Using existing template for now
          data: {
            fullName: existingUser.fullName,
            verificationUrl
          }
        });

        return res.status(200).json({
          success: true,
          message: 'Account details updated! Please verify your email to complete the setup.',
          action: 'verify',
          details: {
            email: existingUser.email,
            accountStatus: 'unverified',
            suggestion: 'We\'ve updated your account information and sent a new verification email. Please check your inbox.'
          }
        });
      }
    }

    // Process expertise array
    const expertiseArray = expertise ? 
      expertise.split(',').map(exp => exp.trim()).filter(exp => exp) : 
      [];

    // Generate verification token
    const verificationToken = generateVerificationToken();

    // Create new user
    const user = new User({
      fullName,
      email: email.toLowerCase(),
      password,
      role: role || 'publisher',
      bio: bio || '',
      expertise: expertiseArray,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    await user.save();

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Welcome to Journal Platform - Verify Your Email',
      template: 'emailVerification',
      data: {
        fullName: user.fullName,
        verificationUrl
      }
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Please check your email to verify your account.',
      action: 'verify',
      details: {
        email: user.email,
        accountStatus: 'created',
        suggestion: 'Check your email inbox (and spam folder) for the verification link.'
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration. Please try again.',
      action: 'retry'
    });
  }
});

// @route   GET /api/auth/verify-email
// @desc    Verify user email
// @access  Public
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find user by verification token
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Email verification token is invalid or has expired.',
        action: 'resend'
      });
    }

    // Verify the user
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Send welcome email
    await sendEmail({
      to: user.email,
      subject: 'Welcome to Journal Platform!',
      template: 'welcome',
      data: {
        fullName: user.fullName,
        loginUrl: `${process.env.FRONTEND_URL}/login`
      }
    });

    res.status(200).json({
      success: true,
      message: 'Email verified successfully! You can now login to your account.'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during email verification.'
    });
  }
});

// @route   POST /api/auth/resend-verification
// @desc    Resend verification email
// @access  Public
router.post('/resend-verification', validateEmail, async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with that email address.'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'This email is already verified. You can login to your account.',
        action: 'login'
      });
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
    await sendEmail({
      to: user.email,
      subject: 'Verify Your Email - Journal Platform',
      template: 'emailVerification',
      data: {
        fullName: user.fullName,
        verificationUrl
      }
    });

    res.status(200).json({
      success: true,
      message: 'Verification email sent! Please check your email to verify your account.'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending verification email.'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email (include password for comparison)
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your email and password.',
        action: 'retry'
      });
    }

    // Check password first
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please check your email and password.',
        action: 'retry'
      });
    }

    // Check if email is verified (after password validation for security)
    if (!user.isEmailVerified) {
      return res.status(401).json({
        success: false,
        message: 'Please verify your email before logging in. Check your inbox for verification link.',
        action: 'verify',
        email: user.email
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
        action: 'contact'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Send welcome back email (optional - you can remove this if you don't want emails on every login)
    try {
      await sendEmail({
        to: user.email,
        subject: 'Welcome Back - Journal Platform',
        template: 'loginWelcome',
        data: {
          fullName: user.fullName,
          loginTime: new Date().toLocaleString(),
          dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
        }
      });
    } catch (emailError) {
      // Don't fail login if email fails
      console.error('Welcome email failed:', emailError);
    }

    // Return user data (password excluded by toJSON method)
    const userData = user.toJSON();

    res.status(200).json({
      success: true,
      message: 'Login successful! Welcome back.',
      token,
      user: userData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login. Please try again.'
    });
  }
});

// In your backend/routes/auth.js file, here's the corrected forgot-password route:

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', validateEmail, async (req, res) => {
  try {
    const { email } = req.body;

    console.log(`🔍 Password reset requested for email: ${email}`);

    const user = await User.findOne({ email: email.toLowerCase() });
    
    // SECURITY FIX: Always return the same response regardless of whether user exists
    // This prevents email enumeration attacks
    const standardResponse = {
      success: true,
      message: 'If an account with that email exists, you will receive a password reset email shortly.',
    };

    if (!user) {
      console.log(`❌ No user found with email: ${email} - but returning success response for security`);
      // Return success response even when user doesn't exist
      // This prevents attackers from discovering valid email addresses
      return res.status(200).json(standardResponse);
    }

    console.log(`✅ User found: ${user.fullName} (${user.email})`);

    if (!user.isEmailVerified) {
      console.log(`❌ User email not verified: ${email} - but returning success response for security`);
      // Even for unverified emails, return success response for security
      // The user won't actually receive the email, but attacker won't know
      return res.status(200).json(standardResponse);
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
    
    console.log(`🔄 Saving reset token for user: ${user.email}`);
    console.log(`🔑 Reset token: ${resetToken}`);
    await user.save();

    // IMPORTANT: Make sure FRONTEND_URL is correctly set
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;
    
    console.log(`🌐 Frontend URL: ${frontendUrl}`);
    console.log(`🔗 Reset URL generated: ${resetUrl}`);

    try {
      // Send reset email - ONLY for verified users who actually exist
      console.log(`📧 Attempting to send password reset email to: ${user.email}`);
      console.log(`👤 User full name: ${user.fullName}`);
      
      const emailResult = await sendEmail({
        to: user.email,
        subject: 'Password Reset Request - Journal Platform',
        template: 'passwordReset',
        data: {
          fullName: user.fullName,
          resetUrl: resetUrl
        }
      });

      console.log(`✅ Password reset email sent successfully:`, emailResult);

      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, you will receive a password reset email shortly.',
        // Only show debug info in development
        debug: process.env.NODE_ENV === 'development' ? {
          emailSentTo: user.email,
          resetToken: resetToken,
          resetUrl: resetUrl,
          expiresAt: new Date(user.resetPasswordExpires).toISOString()
        } : undefined
      });

    } catch (emailError) {
      console.error('❌ Failed to send password reset email:', emailError);
      
      // Clear the reset token since email failed
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();

      // SECURITY: Even if email fails, return success response
      // Log the error for debugging, but don't reveal to user that email failed
      res.status(200).json({
        success: true,
        message: 'If an account with that email exists, you will receive a password reset email shortly.',
        // Only show error details in development
        debug: process.env.NODE_ENV === 'development' ? {
          error: 'EMAIL_SEND_ERROR',
          details: emailError.message
        } : undefined
      });
    }

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    
    // Even on server error, don't reveal details to prevent information disclosure
    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, you will receive a password reset email shortly.',
      debug: process.env.NODE_ENV === 'development' ? {
        error: 'SERVER_ERROR',
        details: error.message
      } : undefined
    });
  }
});

// @route   POST /api/auth/reset-password/:token
// @desc    Reset user password
// @access  Public
router.post('/reset-password/:token', validatePassword, async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Find user by reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired. Please request a new one.',
        action: 'forgot'
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send confirmation email
    await sendEmail({
      to: user.email,
      subject: 'Password Changed Successfully - Journal Platform',
      template: 'passwordChanged',
      data: {
        fullName: user.fullName,
        loginUrl: `${process.env.FRONTEND_URL}/login`
      }
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successfully! You can now login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resetting password.'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user
  });
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal is sufficient)
// @access  Private
router.post('/logout', authenticateToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully!'
  });
});

module.exports = router;