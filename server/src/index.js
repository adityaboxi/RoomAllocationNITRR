
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'nitrr.ac.in';

// ============================================
// RATE LIMITING
// ============================================
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 4,
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Maximum 4 requests per second allowed.'
  }
});

const authLimiter = rateLimit({
  windowMs: 60000,
  max: 10,
  message: {
    success: false,
    error: 'Too many authentication attempts',
    message: 'Please try again after 1 minute.'
  }
});

const otpLimiter = rateLimit({
  windowMs: 60000,
  max: 3,
  message: {
    success: false,
    error: 'Too many OTP requests',
    message: 'Please wait before requesting another OTP.'
  }
});

// ============================================
// MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

// ============================================
// DATABASE CONNECTION
// ============================================
mongoose.connect(process.env.MONGODB_URI, {
  maxPoolSize: 20,
  minPoolSize: 5,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 5000,
})
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => {
  console.error('❌ MongoDB Connection Error:', err.message);
  process.exit(1);
});

// ============================================
// SCHEMAS
// ============================================

// OTP Schema
const OTPSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['signup', 'login', 'reset', 'forgot'],
    default: 'signup'
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000)
  },
  attempts: {
    type: Number,
    default: 0
  },
  verified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// User Schema
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [new RegExp(`@${ALLOWED_DOMAIN}$`), `Email must be @${ALLOWED_DOMAIN}`],
    index: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['hod', 'professor'],
    default: 'professor',
    index: true
  },
  department: {
    type: String,
    required: true,
    enum: ['CSE', 'ECE', 'ME', 'EE', 'CE', 'MME', 'BT', 'IT', 'MCA', 'MBA'],
    index: true
  },
  employeeId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  phone: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: Date,
  hodApproval: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error);
  }
});

UserSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

// Room Schema
const RoomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true, unique: true, index: true },
  capacity: { type: Number, required: true, min: 1, index: true },
  floor: { type: Number, required: true, index: true },
  department: { 
    type: String, 
    required: true,
    enum: ['CSE', 'ECE', 'ME', 'EE', 'CE', 'MME', 'BT', 'IT', 'MCA', 'MBA', 'General'],
    index: true
  },
  building: { type: String, required: true, index: true },
  hasProjector: { type: Boolean, default: false },
  hasAC: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true, index: true }
}, { timestamps: true });

// Timetable Schema
const TimetableSchema = new mongoose.Schema({
  department: { type: String, required: true, enum: ['CSE', 'ECE', 'ME', 'EE', 'CE', 'MME', 'BT', 'IT', 'MCA', 'MBA'], index: true },
  semester: { type: String, required: true, enum: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'], index: true },
  section: { type: String, enum: ['A', 'B', 'C', 'D'], required: true, index: true },
  day: { type: String, required: true, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], index: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  subject: { type: String, required: true },
  professor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
  version: { type: Number, default: 1 }
}, { timestamps: true });

TimetableSchema.index({ department: 1, semester: 1, section: 1, day: 1 });
TimetableSchema.index({ room: 1, day: 1, startTime: 1, endTime: 1 });

// Booking Schema
const BookingSchema = new mongoose.Schema({
  room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, index: true },
  professor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true, index: true },
  day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], required: true, index: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  subject: { type: String, required: true },
  comment: { type: String, default: 'I have taken this class' },
  status: { type: String, enum: ['active', 'cancelled', 'completed', 'conflict'], default: 'active', index: true },
  department: { type: String, required: true, index: true },
  conflictMessage: { type: String, default: '' },
  notified: { type: Boolean, default: false }
}, { timestamps: true });

BookingSchema.index({ room: 1, date: 1, startTime: 1, endTime: 1 }, { unique: true });
BookingSchema.index({ professor: 1, date: 1, status: 1 });

// Create models
const User = mongoose.model('User', UserSchema);
const Room = mongoose.model('Room', RoomSchema);
const Timetable = mongoose.model('Timetable', TimetableSchema);
const Booking = mongoose.model('Booking', BookingSchema);
const OTP = mongoose.model('OTP', OTPSchema);

// ============================================
// EMAIL SERVICE
// ============================================
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Generate OTP
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

// Send OTP Email
const sendOTPEmail = async (email, otp, purpose = 'signup') => {
  const subjects = {
    signup: 'Verify Your Email - NITRR Room Allocation',
    forgot: 'Password Reset OTP - NITRR Room Allocation',
    reset: 'Password Reset Confirmation - NITRR Room Allocation'
  };

  const titles = {
    signup: 'Email Verification',
    forgot: 'Password Reset OTP',
    reset: 'Password Reset Confirmation'
  };

  const messages = {
    signup: 'Thank you for signing up! Please verify your email address.',
    forgot: 'You requested to reset your password. Use the OTP below.',
    reset: 'Your password has been reset successfully.'
  };

  const subject = subjects[purpose] || 'OTP Verification - NITRR Room Allocation';
  const title = titles[purpose] || 'OTP Verification';
  const message = messages[purpose] || 'Your OTP for verification is:';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
        .container { max-width: 500px; margin: 0 auto; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; padding: 20px 0; }
        .otp-code { font-size: 32px; font-weight: bold; color: #2563eb; text-align: center; padding: 20px; background: #f0f7ff; border-radius: 8px; letter-spacing: 5px; }
        .footer { text-align: center; padding: 20px 0; color: #6b7280; font-size: 14px; }
        .warning { color: #dc2626; font-size: 14px; text-align: center; margin-top: 10px; }
        .success { color: #16a34a; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="color: #1e40af;">🏫 NITRR Room Allocation</h1>
          <p style="color: #6b7280;">${title}</p>
        </div>
        <p>Hello,</p>
        <p>${message}</p>
        <div class="otp-code">${otp}</div>
        <p style="text-align: center;">This OTP is valid for <strong>10 minutes</strong>.</p>
        <div class="warning">⚠️ Do not share this OTP with anyone.</div>
        <div class="footer">
          <p>NIT Raipur - Room Allocation System</p>
          <p>This is an automated email. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@nitrr.ac.in',
    to: email,
    subject,
    html
  };

  await transporter.sendMail(mailOptions);
};

// Send Password Reset Success Email
const sendPasswordResetSuccessEmail = async (email, name) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
        .container { max-width: 500px; margin: 0 auto; padding: 20px; background: white; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; padding: 20px 0; }
        .success { color: #16a34a; text-align: center; padding: 20px; background: #f0fdf4; border-radius: 8px; }
        .footer { text-align: center; padding: 20px 0; color: #6b7280; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="color: #1e40af;">🏫 NITRR Room Allocation</h1>
        </div>
        <p>Dear <strong>${name}</strong>,</p>
        <div class="success">
          <h2>✅ Password Reset Successful</h2>
          <p>Your password has been successfully reset.</p>
        </div>
        <p>If you did not request this password reset, please contact support immediately.</p>
        <div class="footer">
          <p>NIT Raipur - Room Allocation System</p>
          <p>This is an automated email. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@nitrr.ac.in',
    to: email,
    subject: '✅ Password Reset Successful - NITRR Room Allocation',
    html
  };

  await transporter.sendMail(mailOptions);
};

// ============================================
// JWT HELPERS
// ============================================
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role ${req.user.role} is not authorized`
      });
    }
    next();
  };
};

// ============================================
// HELPERS
// ============================================
const getDayOfWeek = (date) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(date).getDay()];
};

const isOverlapping = (start1, end1, start2, end2) => {
  return start1 < end2 && start2 < end1;
};

// ============================================
// AUTH ROUTES
// ============================================

// ============================================
// FORGOT PASSWORD ROUTES
// ============================================

// Request OTP for password reset
app.post('/api/auth/forgot-password', otpLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return res.status(400).json({
        success: false,
        message: `Only @${ALLOWED_DOMAIN} email addresses are allowed`
      });
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email'
      });
    }

    // Delete existing OTPs
    await OTP.deleteMany({ email, purpose: 'forgot' });

    // Generate new OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.create({
      email,
      otp,
      purpose: 'forgot',
      expiresAt,
      attempts: 0,
      verified: false
    });

    // Send OTP email
    await sendOTPEmail(email, otp, 'forgot');

    res.json({
      success: true,
      message: 'OTP sent to your email for password reset',
      expiresIn: '10 minutes'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
  }
});

// Verify OTP for password reset
app.post('/api/auth/verify-reset-otp', authLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const otpRecord = await OTP.findOne({ email, otp, purpose: 'forgot' });
    
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (otpRecord.attempts >= 3) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'Too many failed attempts. Please request a new OTP.' });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    // Generate a temporary reset token
    const resetToken = jwt.sign(
      { email }, 
      process.env.JWT_SECRET + 'reset', 
      { expiresIn: '10m' }
    );

    res.json({
      success: true,
      message: 'OTP verified successfully',
      resetToken
    });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
});

// Reset password
app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body;

    if (!email || !resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, reset token, new password and confirm password are required'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Verify reset token
    try {
      jwt.verify(resetToken, process.env.JWT_SECRET + 'reset');
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired reset token. Please request a new OTP.'
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Delete used OTP
    await OTP.deleteMany({ email, purpose: 'forgot' });

    // Send success email
    await sendPasswordResetSuccessEmail(email, user.name);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Password reset failed' });
  }
});

// ============================================
// REGULAR AUTH ROUTES
// ============================================

// Request OTP for signup
app.post('/api/auth/send-otp', otpLimiter, async (req, res) => {
  try {
    const { email, purpose = 'signup' } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return res.status(400).json({
        success: false,
        message: `Only @${ALLOWED_DOMAIN} email addresses are allowed`
      });
    }

    if (purpose === 'signup') {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User already exists with this email'
        });
      }
    }

    await OTP.deleteMany({ email, purpose });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await OTP.create({
      email,
      otp,
      purpose,
      expiresAt,
      attempts: 0,
      verified: false
    });

    await sendOTPEmail(email, otp, purpose);

    res.json({
      success: true,
      message: 'OTP sent successfully to your email',
      expiresIn: '10 minutes'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
  }
});

// Verify OTP for signup
app.post('/api/auth/verify-otp', authLimiter, async (req, res) => {
  try {
    const { email, otp, purpose = 'signup' } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const otpRecord = await OTP.findOne({ email, otp, purpose });
    
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (otpRecord.attempts >= 3) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ success: false, message: 'Too many failed attempts. Please request a new OTP.' });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    res.json({
      success: true,
      message: 'OTP verified successfully',
      verified: true
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
});

// Complete signup
app.post('/api/auth/signup', authLimiter, async (req, res) => {
  try {
    const { name, email, password, role, department, employeeId, phone, otp } = req.body;

    if (!name || !email || !password || !department || !employeeId || !phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return res.status(400).json({
        success: false,
        message: `Only @${ALLOWED_DOMAIN} email addresses are allowed`
      });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { employeeId }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or employee ID'
      });
    }

    const otpRecord = await OTP.findOne({ email, otp, purpose: 'signup', verified: true });
    
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or unverified OTP. Please verify your OTP first.'
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.'
      });
    }

    const userRole = role === 'hod' ? 'hod' : 'professor';
    const hodApproval = role === 'hod' ? 'pending' : 'approved';

    const user = await User.create({
      name,
      email,
      password,
      role: userRole,
      department,
      employeeId,
      phone,
      isEmailVerified: true,
      hodApproval
    });

    await OTP.deleteOne({ _id: otpRecord._id });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: role === 'hod' 
        ? 'HOD registration submitted for approval. You will be notified once approved.'
        : 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        employeeId: user.employeeId,
        hodApproval: user.hodApproval
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return res.status(400).json({
        success: false,
        message: `Only @${ALLOWED_DOMAIN} email addresses are allowed`
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.role === 'hod' && user.hodApproval === 'pending') {
      return res.status(403).json({
        success: false,
        message: 'Your HOD account is pending approval. Please wait for approval.',
        hodApproval: 'pending'
      });
    }

    if (user.role === 'hod' && user.hodApproval === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your HOD account has been rejected. Please contact the administrator.',
        hodApproval: 'rejected'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        employeeId: user.employeeId,
        hodApproval: user.hodApproval
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get current user
app.get('/api/auth/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// HOD APPROVAL ROUTES
// ============================================

app.get('/api/auth/hod-requests', protect, authorize('hod'), async (req, res) => {
  try {
    const hod = await User.findById(req.user.id);
    if (hod.hodApproval !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Your HOD account is not approved yet'
      });
    }

    const pendingHODs = await User.find({
      role: 'hod',
      hodApproval: 'pending'
    }).select('-password');

    res.json({
      success: true,
      data: pendingHODs,
      total: pendingHODs.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/auth/hod-approve/:id', protect, authorize('hod'), async (req, res) => {
  try {
    const currentHod = await User.findById(req.user.id);
    if (currentHod.hodApproval !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Your HOD account is not approved yet'
      });
    }

    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be approved or rejected'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.role !== 'hod') {
      return res.status(400).json({
        success: false,
        message: 'User is not a HOD'
      });
    }

    user.hodApproval = status;
    await user.save();

    res.json({
      success: true,
      message: `HOD account ${status} successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        hodApproval: user.hodApproval
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ROOM ROUTES (Keep existing)
// ============================================

app.get('/api/rooms', protect, async (req, res) => {
  try {
    const { department, building, floor, limit = 100, page = 1 } = req.query;
    const query = {};
    if (department) query.department = department;
    if (building) query.building = building;
    if (floor) query.floor = parseInt(floor);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const rooms = await Room.find(query)
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Room.countDocuments(query);
    res.json({
      success: true,
      data: rooms,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/rooms/available', protect, async (req, res) => {
  try {
    const { date, startTime, endTime, department } = req.query;
    
    if (!date || !startTime || !endTime) {
      return res.status(400).json({
        success: false,
        message: 'date, startTime and endTime are required'
      });
    }

    const day = getDayOfWeek(date);
    const query = { isAvailable: true };
    if (department) query.department = department;

    const allRooms = await Room.find(query).lean();
    
    const bookedRoomIds = await Booking.distinct('room', {
      date: new Date(date),
      status: 'active',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    });

    const timetableRoomIds = await Timetable.distinct('room', {
      day,
      isActive: true,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    });

    const bookedIds = new Set([
      ...bookedRoomIds.map(id => id.toString()),
      ...timetableRoomIds.map(id => id.toString())
    ]);

    const availableRooms = allRooms.filter(room => !bookedIds.has(room._id.toString()));

    res.json({
      success: true,
      data: availableRooms,
      total: availableRooms.length,
      unavailable: allRooms.length - availableRooms.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/rooms', protect, authorize('hod'), async (req, res) => {
  try {
    const room = await Room.create(req.body);
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.put('/api/rooms/:id', protect, authorize('hod'), async (req, res) => {
  try {
    const room = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.json({ success: true, data: room });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.delete('/api/rooms/:id', protect, authorize('hod'), async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ============================================
// BOOKING ROUTES (Keep existing)
// ============================================

app.post('/api/bookings', protect, async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, subject, comment } = req.body;
    
    if (!roomId || !date || !startTime || !endTime || !subject) {
      return res.status(400).json({
        success: false,
        message: 'roomId, date, startTime, endTime, subject are required'
      });
    }

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }

    const day = getDayOfWeek(date);
    const bookingDate = new Date(date);

    const existingBooking = await Booking.findOne({
      room: roomId,
      date: bookingDate,
      status: 'active',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: 'Room is already booked for this time slot'
      });
    }

    const timetableConflict = await Timetable.findOne({
      room: roomId,
      day,
      isActive: true,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    }).populate('professor', 'name email');

    if (timetableConflict && timetableConflict.professor._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: `Room is scheduled for ${timetableConflict.subject} from ${timetableConflict.startTime} to ${timetableConflict.endTime} on ${day}`,
        conflict: true
      });
    }

    const booking = await Booking.create({
      room: roomId,
      professor: req.user._id,
      date: bookingDate,
      day,
      startTime,
      endTime,
      subject,
      comment: comment || 'I have taken this class',
      department: req.user.department
    });

    await booking.populate('room');
    await booking.populate('professor', 'name email');

    res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: booking
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/bookings/my-bookings', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ professor: req.user._id })
      .populate('room')
      .populate('professor', 'name email')
      .sort({ date: -1, startTime: -1 })
      .lean();

    const enrichedBookings = await Promise.all(bookings.map(async (booking) => {
      const day = getDayOfWeek(booking.date);
      const conflictCheck = await Timetable.findOne({
        room: booking.room._id,
        day,
        isActive: true,
        startTime: { $lt: booking.endTime },
        endTime: { $gt: booking.startTime }
      }).populate('professor', 'name');

      return {
        ...booking,
        hasConflict: !!conflictCheck && booking.status === 'active',
        conflictDetails: conflictCheck ? {
          subject: conflictCheck.subject,
          professor: conflictCheck.professor.name,
          time: `${conflictCheck.startTime} - ${conflictCheck.endTime}`
        } : null
      };
    }));

    res.json({ success: true, data: enrichedBookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/bookings/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.professor.toString() !== req.user._id.toString() && req.user.role !== 'hod') {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    booking.status = 'cancelled';
    await booking.save();
    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/bookings/all', protect, authorize('hod'), async (req, res) => {
  try {
    const { status, department, date, limit = 50, page = 1 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (department) query.department = department;
    if (date) query.date = new Date(date);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const bookings = await Booking.find(query)
      .populate('room')
      .populate('professor', 'name email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const total = await Booking.countDocuments(query);
    res.json({
      success: true,
      data: bookings,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// TIMETABLE ROUTES (Keep existing)
// ============================================

app.post('/api/timetable', protect, authorize('hod'), async (req, res) => {
  try {
    const { department, semester, section, entries } = req.body;
    
    if (!department || !semester || !section || !entries || !Array.isArray(entries)) {
      return res.status(400).json({
        success: false,
        message: 'department, semester, section and entries array are required'
      });
    }

    await Timetable.updateMany(
      { department, semester, section, isActive: true },
      { isActive: false, version: { $inc: 1 } }
    );

    const newEntries = [];
    for (const entry of entries) {
      const { day, startTime, endTime, subject, professorId, roomId } = entry;
      
      const professor = await User.findById(professorId);
      if (!professor) {
        return res.status(404).json({ success: false, message: `Professor not found: ${professorId}` });
      }

      const room = await Room.findById(roomId);
      if (!room) {
        return res.status(404).json({ success: false, message: `Room not found: ${roomId}` });
      }

      newEntries.push({
        department, semester, section, day, startTime, endTime, subject,
        professor: professorId, room: roomId, version: 1, isActive: true
      });
    }

    await Timetable.insertMany(newEntries);

    const activeBookings = await Booking.find({
      department,
      status: 'active'
    }).populate('professor').populate('room');

    const cancelledBookings = [];
    for (const booking of activeBookings) {
      const bookingDay = getDayOfWeek(booking.date);
      
      for (const timetable of newEntries) {
        if (timetable.day === bookingDay &&
            isOverlapping(booking.startTime, booking.endTime, timetable.startTime, timetable.endTime) &&
            booking.room._id.toString() === timetable.room.toString()) {
          
          booking.status = 'cancelled';
          booking.conflictMessage = `Room ${booking.room.roomNumber} scheduled for ${timetable.subject} from ${timetable.startTime} to ${timetable.endTime}`;
          await booking.save();
          cancelledBookings.push(booking);
        }
      }
    }

    res.json({
      success: true,
      message: 'Timetable updated successfully',
      data: {
        entriesAdded: newEntries.length,
        bookingsCancelled: cancelledBookings.length
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

app.get('/api/timetable', protect, async (req, res) => {
  try {
    const { department, semester, section } = req.query;
    const query = { isActive: true };
    if (department) query.department = department;
    if (semester) query.semester = semester;
    if (section) query.section = section;

    const timetable = await Timetable.find(query)
      .populate('professor', 'name email')
      .populate('room', 'roomNumber capacity building')
      .sort({ day: 1, startTime: 1 })
      .lean();

    const groupedByDay = timetable.reduce((acc, entry) => {
      if (!acc[entry.day]) acc[entry.day] = [];
      acc[entry.day].push(entry);
      return acc;
    }, {});

    res.json({ success: true, data: groupedByDay, total: timetable.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    rateLimit: `${process.env.RATE_LIMIT_MAX || 4} requests/second`,
    allowedDomain: `@${ALLOWED_DOMAIN}`
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏫 Room Allocation System API - NIT Raipur',
    version: '1.0.0',
    status: 'Running',
    allowedDomain: `@${ALLOWED_DOMAIN}`,
    rateLimit: `${process.env.RATE_LIMIT_MAX || 4} requests/second`
  });
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ============================================
// SEED DATA
// ============================================
const seedData = async () => {
  try {
    const count = await User.countDocuments();
    if (count === 0) {
      console.log('🌱 Seeding initial data...');
      
      const hodPassword = await bcrypt.hash('Hod@12345', 10);
      await User.create({
        name: 'Dr. HOD Singh',
        email: 'hod@nitrr.ac.in',
        password: hodPassword,
        role: 'hod',
        department: 'CSE',
        employeeId: 'HOD001',
        phone: '9876543210',
        isEmailVerified: true,
        hodApproval: 'approved'
      });

      const profPassword = await bcrypt.hash('Prof@12345', 10);
      await User.create({
        name: 'Dr. Priya Sharma',
        email: 'prof@nitrr.ac.in',
        password: profPassword,
        role: 'professor',
        department: 'CSE',
        employeeId: 'PROF001',
        phone: '9876543211',
        isEmailVerified: true,
        hodApproval: 'approved'
      });

      const rooms = [
        { roomNumber: '101', capacity: 60, floor: 1, department: 'CSE', building: 'Main Building', hasProjector: true, hasAC: true },
        { roomNumber: '102', capacity: 40, floor: 1, department: 'CSE', building: 'Main Building', hasProjector: true, hasAC: false },
        { roomNumber: '103', capacity: 50, floor: 1, department: 'ECE', building: 'Main Building', hasProjector: false, hasAC: true },
        { roomNumber: '201', capacity: 45, floor: 2, department: 'EE', building: 'Main Building', hasProjector: true, hasAC: true },
        { roomNumber: '202', capacity: 35, floor: 2, department: 'ME', building: 'Main Building', hasProjector: false, hasAC: false },
        { roomNumber: '301', capacity: 55, floor: 3, department: 'CSE', building: 'Main Building', hasProjector: true, hasAC: true },
        { roomNumber: '302', capacity: 40, floor: 3, department: 'ECE', building: 'Main Building', hasProjector: false, hasAC: true },
        { roomNumber: '401', capacity: 50, floor: 4, department: 'IT', building: 'Main Building', hasProjector: true, hasAC: false },
        { roomNumber: '402', capacity: 30, floor: 4, department: 'MCA', building: 'Main Building', hasProjector: false, hasAC: true },
        { roomNumber: '501', capacity: 45, floor: 5, department: 'MBA', building: 'Main Building', hasProjector: true, hasAC: true }
      ];
      await Room.insertMany(rooms);

      console.log('✅ Seed data created successfully!');
      console.log('📋 Demo Accounts (Only @nitrr.ac.in):');
      console.log('  HOD: hod@nitrr.ac.in / Hod@12345');
      console.log('  Professor: prof@nitrr.ac.in / Prof@12345');
    }
  } catch (error) {
    console.error('❌ Seed error:', error.message);
  }
};

setTimeout(() => {
  seedData();
}, 1000);

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🚀 Room Allocation System Server');
  console.log('========================================');
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`📧 Allowed Domain: @${ALLOWED_DOMAIN}`);
  console.log(`⏱️  Rate Limit: ${process.env.RATE_LIMIT_MAX || 4} requests/second`);
  console.log('========================================');
  console.log('📋 Demo Accounts:');
  console.log('  HOD: hod@nitrr.ac.in / Hod@12345');
  console.log('  Professor: prof@nitrr.ac.in / Prof@12345');
  console.log('========================================');
  console.log('📋 Features:');
  console.log('  ✅ OTP Verification via Email');
  console.log('  ✅ Forgot Password with OTP');
  console.log('  ✅ Reset Password with OTP');
  console.log('  ✅ HOD Role with Approval System');
  console.log('  ✅ Email Domain Restriction (@nitrr.ac.in)');
  console.log('========================================\n');
});

module.exports = app;
