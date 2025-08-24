const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const manuscriptRoutes = require('./routes/manuscript');

dotenv.config();

const app = express();

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Define allowed origins
    const allowedOrigins = [
      'http://localhost:5173',
      'https://journalise.vercel.app'
    ]

    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      console.log('Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],
  exposedHeaders: ['Content-Length', 'X-JSON'],
  maxAge: 86400, // Cache preflight response for 24 hours
  optionsSuccessStatus: 200 // For legacy browser support
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Add security headers middleware
app.use((req, res, next) => {
  // Set CORS headers manually as backup
  const allowedOrigin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'https://journal-website-three.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean);

  if (allowedOrigins.includes(allowedOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  next();
});

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/journal_platform', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

// Email service initialization
const { testEmailConnection } = require('./utils/emailService');

const initializeServices = async () => {
  console.log('\n🚀 Initializing services...');
  
  // Test email service
  const emailWorking = await testEmailConnection();
  if (!emailWorking) {
    console.log('\n⚠️  EMAIL SERVICE SETUP REQUIRED:');
    console.log('1. Create a Gmail account or use existing one');
    console.log('2. Enable 2-Factor Authentication');
    console.log('3. Generate App Password: https://myaccount.google.com/apppasswords');
    console.log('4. Set environment variables:');
    console.log('   EMAIL_HOST=smtp.gmail.com');
    console.log('   EMAIL_PORT=587');
    console.log('   EMAIL_USER=your-email@gmail.com');
    console.log('   EMAIL_PASS=your-app-password');
    console.log('\n📝 Create a .env file with these variables or set them in your hosting environment\n');
  }
};

// Call this after MongoDB connection is established
db.once('open', async () => {
  console.log('Connected to MongoDB');
  await initializeServices();
});

// Enhanced Health check route with CORS debugging info
app.get('/api/health', (req, res) => {
  const requestOrigin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'https://journal-website-three.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean);

  res.json({ 
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cors: {
      requestOrigin: requestOrigin || 'No origin header',
      allowedOrigins: allowedOrigins,
      isOriginAllowed: allowedOrigins.includes(requestOrigin),
      frontendUrl: process.env.FRONTEND_URL
    }
  });
});

// Test email endpoint for debugging
app.get('/api/test-email', async (req, res) => {
  try {
    const { sendEmail } = require('./utils/emailService');
    
    const testEmail = req.query.email || process.env.EMAIL_USER;
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email parameter: /api/test-email?email=your@email.com'
      });
    }

    await sendEmail({
      to: testEmail,
      template: 'passwordReset',
      data: {
        fullName: 'Test User',
        resetUrl: 'https://example.com/test-reset-link'
      }
    });

    res.json({
      success: true,
      message: `Test email sent successfully to ${testEmail}`
    });

  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({
      success: false,
      message: 'Test email failed',
      error: error.message
    });
  }
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/manuscripts', manuscriptRoutes);

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('Global Error Handler:', error);
  
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors
    });
  }
  
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
  }
  
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Internal Server Error'
  });
});

// Handle undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false,
    message: 'Route not found',
    requestedPath: req.originalUrl,
    availableRoutes: [
      'GET /api/health',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/me',
      'POST /api/auth/logout'
    ]
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📧 Email service configured: ${process.env.EMAIL_HOST || 'Not configured'}`);
  console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`🌍 Server URL: ${process.env.NODE_ENV === 'production' ? 'https://journal-website-it00.onrender.com' : `http://localhost:${PORT}`}`);
  console.log(`📋 CORS enabled for: http://localhost:3000, ${process.env.FRONTEND_URL || 'undefined'}`);
});