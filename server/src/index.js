/*const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// ============================================
// EMAIL SERVICE
// ============================================
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || process.env.FROM_EMAIL,
    pass: process.env.SMTP_PASS,
  },
});

// This function is kept but NOT called during testing – OTPs are logged instead.
const sendOTPEmail = async (email, otp, purpose = 'forgot') => {
  const subject = purpose === 'forgot' ? 'Password Reset OTP' : 'Email Verification';
  const html = `
  <div style="font-family:Arial;max-width:500px;margin:40px auto;background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
    <h2 style="color:#1e40af;text-align:center">🏫 NITRR Room Allocation</h2>
    <p style="text-align:center;color:#6b7280">${purpose === 'forgot' ? 'Password Reset OTP' : 'Email Verification'}</p>
    <div style="background:#eff6ff;padding:20px;text-align:center;border-radius:8px;margin:20px 0">
      <span style="font-size:36px;font-weight:700;color:#1e40af;letter-spacing:6px">${otp}</span>
    </div>
    <p style="text-align:center;color:#6b7280;font-size:14px">Valid for 5 minutes</p>
    <p style="text-align:center;color:#dc2626;font-size:13px">⚠️ Do not share this OTP</p>
    <hr style="border:1px solid #e5e7eb;margin:20px 0">
    <p style="text-align:center;color:#9ca3af;font-size:12px">NIT Raipur - Room Allocation System</p>
  </div>`;
  // Email sending is disabled during testing – we only log OTP.
  // await transporter.sendMail({ ... });
  console.log(`📧 (Email skipped) OTP for ${email}: ${otp}`);
};

const sendBookingConfirmationEmail = async (booking) => {
  const html = `
  <div style="font-family:Arial;max-width:500px;margin:40px auto;background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
    <h2 style="color:#059669;text-align:center">✅ Booking Confirmed</h2>
    <p>Dear <strong>${booking.facultyName}</strong>,</p>
    <div style="background:#f0fdf4;padding:15px;border-radius:8px;margin:15px 0">
      <p><strong>Room:</strong> ${booking.roomId?.name} (${booking.roomId?.roomNumber})</p>
      <p><strong>Location:</strong> ${booking.roomId?.building}, ${booking.roomId?.floor}</p>
      <p><strong>Date:</strong> ${booking.date}</p>
      <p><strong>Time:</strong> ${booking.startTime} - ${booking.endTime}</p>
      <p><strong>Purpose:</strong> ${booking.purpose}</p>
      ${booking.comment ? `<p><strong>Comment:</strong> ${booking.comment}</p>` : ''}
    </div>
    <hr style="border:1px solid #e5e7eb;margin:20px 0">
    <p style="text-align:center;color:#9ca3af;font-size:12px">NIT Raipur - Room Allocation System</p>
  </div>`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@nitrr.ac.in',
    to: booking.facultyEmail,
    subject: '✅ Booking Confirmed',
    html,
  });
};

const sendBookingCancellationEmail = async (booking, reason) => {
  const html = `
  <div style="font-family:Arial;max-width:500px;margin:40px auto;background:#fff;padding:30px;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1)">
    <h2 style="color:#dc2626;text-align:center">❌ Booking Cancelled</h2>
    <p>Dear <strong>${booking.facultyName}</strong>,</p>
    <p>Your booking has been cancelled:</p>
    <div style="background:#fef2f2;padding:15px;border-radius:8px;margin:15px 0">
      <p><strong>Room:</strong> ${booking.roomId?.name} (${booking.roomId?.roomNumber})</p>
      <p><strong>Date:</strong> ${booking.date}</p>
      <p><strong>Time:</strong> ${booking.startTime} - ${booking.endTime}</p>
      <p><strong>Reason:</strong> ${reason}</p>
    </div>
    <hr style="border:1px solid #e5e7eb;margin:20px 0">
    <p style="text-align:center;color:#9ca3af;font-size:12px">NIT Raipur - Room Allocation System</p>
  </div>`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'noreply@nitrr.ac.in',
    to: booking.facultyEmail,
    subject: '❌ Booking Cancelled',
    html,
  });
};

// ============================================
// APP & SERVER SETUP
// ============================================
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
});

const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE (express)
// ============================================
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// ============================================
// SOCKET.IO AUTHENTICATION & STATE
// ============================================
const onlineUsers = new Map(); // userId -> socketId

io.use((socket, next) => {
  const token = socket.handshake.query.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 User ${socket.userId} connected`);
  onlineUsers.set(socket.userId, socket.id);

  socket.on('disconnect', () => {
    console.log(`🔌 User ${socket.userId} disconnected`);
    onlineUsers.delete(socket.userId);
  });
});

// Helper to emit event to a specific user
const emitToUser = (userId, event, data) => {
  const socketId = onlineUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit(event, data);
  }
};

// ============================================
// DATABASE CONNECTION
// ============================================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/roomallocation')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// ============================================
// HELPERS
// ============================================
const generateOTP = () => crypto.randomInt(100000, 999999).toString();
const getDayOfWeek = (date) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(date).getDay()];
};
const isOverlapping = (start1, end1, start2, end2) => {
  const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  return toMinutes(start1) < toMinutes(end2) && toMinutes(start2) < toMinutes(end1);
};
const generateLockId = () => `lock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
const generateToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
const loginAttempts = new Map();

// ============================================
// SCHEMAS / MODELS
// ============================================

// 1. USER SCHEMA – email regex changed to only @gmail.com
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: {
    type: String, required: true, unique: true, lowercase: true, trim: true,
    match: [/^[a-zA-Z0-9._%+-]+@gmail\.com$/, 'Only @gmail.com email addresses are allowed for testing']
  },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['FACULTY', 'HOD'], required: true },
  department: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
}, { timestamps: true });

// 🔧 TEMPORARY: disable bcrypt hashing
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  // this.password = await bcrypt.hash(this.password, 10);
  // Store plain text for testing
  next();
});

// 🔧 TEMPORARY: replace bcrypt.compare with plain text comparison
UserSchema.methods.comparePassword = async function(password) {
  // return await bcrypt.compare(password, this.password);
  return this.password === password;
};

UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

UserSchema.statics.isValidEmail = function(email) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(email);
};

UserSchema.statics.detectRole = function(email) {
  const localPart = email.split('@')[0];
  if (localPart.startsWith('hod.') || localPart.startsWith('head.') || localPart === 'hod') return 'HOD';
  return 'FACULTY';
};

UserSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  }
});

const User = mongoose.model('User', UserSchema);

// 2. ROOM SCHEMA - Enhanced with full details (unchanged)
const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  roomNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
  capacity: { type: Number, required: true, min: 1 },
  type: { type: String, enum: ['Classroom', 'Lab', 'Auditorium', 'Lecture Hall', 'Seminar Hall', 'Conference Room'], required: true },
  floor: { type: String, required: true },
  building: { type: String, required: true },
  department: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true },
  hasProjector: { type: Boolean, default: false },
  hasAC: { type: Boolean, default: false },
  hasSmartBoard: { type: Boolean, default: false },
  hasWiFi: { type: Boolean, default: false },
}, { timestamps: true });

RoomSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Room = mongoose.model('Room', RoomSchema);

// 3. TIMETABLE SCHEMA - Department-specific (unchanged)
const TimetableSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  subject: { type: String, required: true, trim: true },
  classGroup: { type: String, required: true, trim: true },
  faculty: { type: String, required: true, trim: true },
  semester: { type: String, enum: ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'], required: true },
  section: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
  department: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  version: { type: Number, default: 1 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

TimetableSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Timetable = mongoose.model('Timetable', TimetableSchema);

// 4. BOOKING SCHEMA (unchanged)
const BookingSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  date: { type: String, required: true },
  day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  facultyName: { type: String, required: true, trim: true },
  facultyEmail: { type: String, required: true, trim: true },
  purpose: { type: String, required: true, trim: true },
  comment: { type: String, default: 'No comment provided' },
  department: { type: String, required: true },
  status: { type: String, enum: ['active', 'cancelled', 'completed', 'conflict'], default: 'active' },
  conflictMessage: { type: String, default: '' },
  lockId: { type: String, sparse: true },
  lockedAt: { type: Date },
  notified: { type: Boolean, default: false }
}, { timestamps: true });

BookingSchema.index({ roomId: 1, date: 1, startTime: 1, endTime: 1 }, { unique: true });
BookingSchema.index({ lockedAt: 1 }, { expireAfterSeconds: 300 });

BookingSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Booking = mongoose.model('Booking', BookingSchema);

// 5. OTP SCHEMA (unchanged)
const OTPSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  otp: { type: String, required: true },
  purpose: { type: String, enum: ['signup', 'forgot'], default: 'signup' },
  expiresAt: { type: Date, required: true, default: () => new Date(Date.now() + 5 * 60 * 1000) },
  attempts: { type: Number, default: 0 },
  verified: { type: Boolean, default: false }
}, { timestamps: true });

OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const OTP = mongoose.model('OTP', OTPSchema);

// ============================================
// MIDDLEWARE - AUTH PROTECTION
// ============================================
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: `Role ${req.user.role} not authorized` });
  }
  next();
};

// ============================================
// AUTH ROUTES
// ============================================

// LOGIN with rate limiting – uses modified comparePassword (plain text)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`🔑 Login attempt for: ${email}`);

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password required' });
    }

    const key = `login_${email}`;
    const attempts = loginAttempts.get(key) || { count: 0, lastAttempt: Date.now() };
    if (Date.now() - attempts.lastAttempt > 15 * 60 * 1000) {
      loginAttempts.set(key, { count: 0, lastAttempt: Date.now() });
    }
    if (attempts.count >= 5) {
      return res.status(429).json({ success: false, message: 'Too many failed attempts. Please try again after 15 minutes.' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      attempts.count += 1;
      loginAttempts.set(key, attempts);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account deactivated. Please contact admin.' });
    }

    // 🔧 uses plain text comparison (modified method)
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      attempts.count += 1;
      loginAttempts.set(key, attempts);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    loginAttempts.delete(key);
    await user.updateLastLogin();
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// SIGNUP – unchanged, but pre‑save does not hash, so password stored as plain text
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, department } = req.body;
    console.log(`📝 Signup attempt for: ${email}`);

    if (!name || !email || !password || !confirmPassword || !department) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one uppercase, one lowercase, one number, and one special character' });
    }
    if (!User.isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Only @gmail.com email addresses are allowed' });
    }
    if (name.length > 100) {
      return res.status(400).json({ success: false, message: 'Name cannot exceed 100 characters' });
    }

    const role = User.detectRole(email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    const user = await User.create({ name, email, password, role, department, isActive: true });
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department }
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// CHANGE PASSWORD – uses modified comparePassword (plain text)
app.post('/api/auth/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one uppercase, one lowercase, one number, and one special character' });
    }

    const user = await User.findById(req.user.id).select('+password');
    // 🔧 plain text comparison
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    user.password = newPassword; // stored as plain text
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// FORGOT PASSWORD – 🔧 logs OTP to console instead of sending email
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`🔐 Forgot password for: ${email}`);

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    }

    const existingOTP = await OTP.findOne({ email, purpose: 'forgot', verified: false });
    if (existingOTP && existingOTP.expiresAt > new Date()) {
      return res.status(400).json({ success: false, message: 'OTP already sent. Please check your email or wait for it to expire.' });
    }

    const otp = generateOTP();
    console.log(`📧 OTP for ${email}: ${otp}`); // <-- OTP printed to console

    await OTP.create({ email, otp, purpose: 'forgot', expiresAt: new Date(Date.now() + 5 * 60 * 1000) });

    // 🔧 Email sending disabled – just log OTP
    // try {
    //   await sendOTPEmail(email, otp, 'forgot');
    //   console.log(`✅ OTP email sent to ${email}`);
    // } catch (emailError) {
    //   console.error(`❌ Failed to send OTP email: ${emailError.message}`);
    // }

    res.json({ success: true, message: 'OTP sent for password reset (check console)', expiresIn: '5 minutes' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// VERIFY RESET OTP – unchanged
app.post('/api/auth/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP required' });
    }

    const otpDoc = await OTP.findOne({ email, purpose: 'forgot', otp, verified: false });
    if (!otpDoc) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    if (otpDoc.expiresAt < new Date()) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ success: false, message: 'OTP expired' });
    }
    if (otpDoc.attempts >= 3) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ success: false, message: 'Too many failed attempts' });
    }
    if (otpDoc.otp !== otp) {
      otpDoc.attempts += 1;
      await otpDoc.save();
      const remaining = 3 - otpDoc.attempts;
      return res.status(400).json({ success: false, message: `Invalid OTP. ${remaining} attempts remaining.` });
    }

    otpDoc.verified = true;
    await otpDoc.save();

    const resetToken = jwt.sign({ email }, process.env.JWT_SECRET + 'reset', { expiresIn: '10m' });
    res.json({ success: true, message: 'OTP verified successfully', resetToken });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({ success: false, message: 'OTP verification failed' });
  }
});

// RESET PASSWORD – unchanged, password stored as plain text (pre-save not hashing)
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, resetToken, newPassword, confirmPassword } = req.body;
    if (!email || !resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one uppercase, one lowercase, one number, and one special character' });
    }

    try { jwt.verify(resetToken, process.env.JWT_SECRET + 'reset'); } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired reset token' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.password = newPassword;
    await user.save();
    await OTP.deleteMany({ email, purpose: 'forgot' });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Password reset failed' });
  }
});

app.get('/api/auth/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ============================================
// ROOM ROUTES - Enhanced with filters (unchanged)
// ============================================

// Get all rooms with comprehensive filters
app.get('/api/rooms', protect, async (req, res) => {
  try {
    const { department, floor, building, isAvailable, search, roomType, hasProjector, hasAC, hasSmartBoard, sortBy } = req.query;
    const query = { isActive: true };
    
    if (department) query.department = department;
    if (floor) query.floor = floor;
    if (building) query.building = building;
    if (isAvailable !== undefined) query.isAvailable = isAvailable === 'true';
    if (roomType) query.type = roomType;
    if (hasProjector === 'true') query.hasProjector = true;
    if (hasAC === 'true') query.hasAC = true;
    if (hasSmartBoard === 'true') query.hasSmartBoard = true;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { roomNumber: { $regex: search, $options: 'i' } },
        { building: { $regex: search, $options: 'i' } }
      ];
    }

    let sortQuery = {};
    if (sortBy === 'floor') sortQuery = { floor: 1, roomNumber: 1 };
    else if (sortBy === 'capacity') sortQuery = { capacity: -1 };
    else if (sortBy === 'name') sortQuery = { name: 1 };
    else sortQuery = { floor: 1, roomNumber: 1 };

    const rooms = await Room.find(query).sort(sortQuery);
    res.json({ success: true, data: rooms, total: rooms.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get room by ID
app.get('/api/rooms/:id', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    res.json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get available rooms for a specific time slot with filters
app.get('/api/rooms/available', protect, async (req, res) => {
  try {
    const { date, startTime, endTime, department, floor, building, roomType, hasProjector, hasAC } = req.query;
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'date, startTime and endTime are required' });
    }

    const day = getDayOfWeek(date);
    const query = { isAvailable: true, isActive: true };
    if (department) query.department = department;
    if (floor) query.floor = floor;
    if (building) query.building = building;
    if (roomType) query.type = roomType;
    if (hasProjector === 'true') query.hasProjector = true;
    if (hasAC === 'true') query.hasAC = true;

    const allRooms = await Room.find(query);
    const bookedRoomIds = await Booking.distinct('roomId', {
      date: date,
      status: 'active',
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    });
    const timetableRoomIds = await Timetable.distinct('roomId', {
      day,
      isActive: true,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime }
    });

    const bookedIds = new Set([...bookedRoomIds.map(id => id.toString()), ...timetableRoomIds.map(id => id.toString())]);
    const availableRooms = allRooms.filter(room => !bookedIds.has(room._id.toString()));

    res.json({
      success: true,
      data: availableRooms,
      total: availableRooms.length,
      unavailable: allRooms.length - availableRooms.length,
      filters: { department, floor, building, roomType, hasProjector, hasAC }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get floor-wise room availability
app.get('/api/rooms/floors', protect, async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true }).sort({ floor: 1, roomNumber: 1 });
    const groupedByFloor = rooms.reduce((acc, room) => {
      if (!acc[room.floor]) acc[room.floor] = [];
      acc[room.floor].push(room);
      return acc;
    }, {});
    res.json({ success: true, data: groupedByFloor });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get building-wise room summary
app.get('/api/rooms/buildings', protect, async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true });
    const groupedByBuilding = rooms.reduce((acc, room) => {
      if (!acc[room.building]) acc[room.building] = [];
      acc[room.building].push(room);
      return acc;
    }, {});
    res.json({ success: true, data: groupedByBuilding });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create room (HOD only)
app.post('/api/rooms', protect, authorize('HOD'), async (req, res) => {
  try {
    // HOD can only create rooms for their department
    if (req.body.department && req.body.department !== req.user.department) {
      return res.status(403).json({ success: false, message: `You can only create rooms for your department (${req.user.department})` });
    }
    req.body.department = req.user.department;
    const room = await Room.create(req.body);
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Room already exists with this name or room number' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update room (HOD only)
app.put('/api/rooms/:id', protect, authorize('HOD'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.department !== req.user.department) {
      return res.status(403).json({ success: false, message: `You can only update rooms for your department` });
    }
    const updatedRoom = await Room.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: updatedRoom });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Room already exists with this name or room number' });
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

// Toggle room availability (HOD only)
app.put('/api/rooms/:id/toggle', protect, authorize('HOD'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.department !== req.user.department) {
      return res.status(403).json({ success: false, message: `You can only toggle rooms for your department` });
    }
    room.isAvailable = !room.isAvailable;
    await room.save();
    res.json({ success: true, message: `Room availability set to ${room.isAvailable}`, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete room (HOD only)
app.delete('/api/rooms/:id', protect, authorize('HOD'), async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (room.department !== req.user.department) {
      return res.status(403).json({ success: false, message: `You can only delete rooms for your department` });
    }
    await Room.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Check room availability for a specific day and time
app.get('/api/rooms/:roomId/availability', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { day, time } = req.query;
    if (!day || !time) return res.status(400).json({ success: false, message: 'Day and time required' });

    const ttClash = await Timetable.findOne({
      roomId, day, startTime: { $lte: time }, endTime: { $gt: time }, isActive: true
    });
    if (ttClash) {
      return res.json({
        success: true, available: false, reason: 'Timetable class',
        details: { subject: ttClash.subject, classGroup: ttClash.classGroup, faculty: ttClash.faculty, until: ttClash.endTime }
      });
    }

    const bookingClash = await Booking.findOne({
      roomId, date: new Date().toISOString().split('T')[0],
      startTime: { $lte: time }, endTime: { $gt: time }, status: 'active'
    });
    if (bookingClash) {
      return res.json({
        success: true, available: false, reason: 'Booking',
        details: { purpose: bookingClash.purpose, facultyName: bookingClash.facultyName, until: bookingClash.endTime }
      });
    }

    res.json({ success: true, available: true, message: 'Room is available' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// TIMETABLE ROUTES - UPDATED WITH SOCKET NOTIFICATIONS
// ============================================

// Helper: cancel conflicting bookings for a set of timetable entries
// Returns array of cancelled bookings
const cancelConflictingBookings = async (timetableEntries, department) => {
  const cancelledBookings = [];
  const activeBookings = await Booking.find({
    department,
    status: 'active'
  }).populate('roomId');

  for (const booking of activeBookings) {
    const bookingDay = getDayOfWeek(booking.date);
    for (const timetable of timetableEntries) {
      if (timetable.day === bookingDay &&
          isOverlapping(booking.startTime, booking.endTime, timetable.startTime, timetable.endTime) &&
          booking.roomId._id.toString() === timetable.roomId.toString()) {
        
        booking.status = 'cancelled';
        booking.conflictMessage = `Room ${booking.roomId.name} is now scheduled for ${timetable.subject} from ${timetable.startTime} to ${timetable.endTime}`;
        await booking.save();
        cancelledBookings.push(booking);

        // Send email
        try {
          await sendBookingCancellationEmail(booking, booking.conflictMessage);
          booking.notified = true;
          await booking.save();
        } catch (emailError) {
          console.error('Failed to send cancellation email:', emailError.message);
        }

        // Send socket notification to the faculty
        const facultyUser = await User.findOne({ email: booking.facultyEmail });
        if (facultyUser) {
          emitToUser(facultyUser._id.toString(), 'booking-cancelled', {
            bookingId: booking.id,
            roomName: booking.roomId.name,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            reason: booking.conflictMessage,
          });
        }
      }
    }
  }
  return cancelledBookings;
};

// Get all timetable entries
app.get('/api/timetable', protect, async (req, res) => {
  try {
    const { department, semester, section, day, faculty } = req.query;
    const query = { isActive: true };
    
    if (req.user.role === 'HOD') {
      query.department = req.user.department;
    }
    if (department) query.department = department;
    if (semester) query.semester = semester;
    if (section) query.section = section;
    if (day) query.day = day;
    if (faculty) query.faculty = { $regex: faculty, $options: 'i' };

    const entries = await Timetable.find(query)
      .populate('roomId', 'name roomNumber floor building')
      .sort({ day: 1, startTime: 1 });
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get timetable by department
app.get('/api/timetable/department/:department', protect, async (req, res) => {
  try {
    const { department } = req.params;
    const { semester, section } = req.query;
    
    if (req.user.role === 'HOD' && req.user.department !== department) {
      return res.status(403).json({ success: false, message: 'You can only view your own department timetable' });
    }

    const query = { department, isActive: true };
    if (semester) query.semester = semester;
    if (section) query.section = section;

    const entries = await Timetable.find(query)
      .populate('roomId', 'name roomNumber floor building')
      .sort({ day: 1, startTime: 1 });
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get faculty-wise timetable
app.get('/api/timetable/faculty/:facultyName', protect, async (req, res) => {
  try {
    const { facultyName } = req.params;
    const { department } = req.query;
    const query = { faculty: { $regex: facultyName, $options: 'i' }, isActive: true };
    if (department) query.department = department;
    if (req.user.role === 'HOD' && department && req.user.department !== department) {
      return res.status(403).json({ success: false, message: 'You can only view your own department timetable' });
    }
    const entries = await Timetable.find(query)
      .populate('roomId', 'name roomNumber floor building')
      .sort({ day: 1, startTime: 1 });
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get room-wise timetable
app.get('/api/timetable/room/:roomId', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (req.user.role === 'HOD' && room.department !== req.user.department) {
      return res.status(403).json({ success: false, message: 'You can only view your own department timetable' });
    }
    const entries = await Timetable.find({ roomId, isActive: true })
      .sort({ day: 1, startTime: 1 });
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create timetable entries (HOD only) – replaces entire timetable
app.post('/api/timetable', protect, authorize('HOD'), async (req, res) => {
  try {
    const { department, semester, section, entries } = req.body;
    
    if (!department || !semester || !section || !entries || !Array.isArray(entries)) {
      return res.status(400).json({ success: false, message: 'department, semester, section and entries array are required' });
    }

    if (req.user.department !== department) {
      return res.status(403).json({ success: false, message: `You can only manage timetable for your own department (${req.user.department})` });
    }

    const validatedEntries = [];
    const errors = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const { day, startTime, endTime, subject, roomId, classGroup, faculty } = entry;

      if (!day || !startTime || !endTime || !subject || !roomId || !classGroup || !faculty) {
        errors.push(`Entry ${i + 1}: All fields are required`);
        continue;
      }

      if (startTime >= endTime) {
        errors.push(`Entry ${i + 1}: Start time must be before end time`);
        continue;
      }

      const [sH, sM] = startTime.split(':').map(Number);
      const [eH, eM] = endTime.split(':').map(Number);
      const durationMinutes = (eH * 60 + eM) - (sH * 60 + sM);
      if (durationMinutes < 30) {
        errors.push(`Entry ${i + 1}: Time slot must be at least 30 minutes`);
        continue;
      }

      const room = await Room.findById(roomId);
      if (!room) {
        errors.push(`Entry ${i + 1}: Room not found`);
        continue;
      }
      if (room.department !== department) {
        errors.push(`Entry ${i + 1}: Room ${room.name} does not belong to ${department} department`);
        continue;
      }

      validatedEntries.push({
        roomId, day, startTime, endTime, subject, classGroup, faculty,
        semester, section, department, createdBy: req.user._id
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: 'Validation errors found', errors });
    }

    if (validatedEntries.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid entries to add' });
    }

    // Deactivate old timetable
    await Timetable.updateMany(
      { department, semester, section, isActive: true },
      { isActive: false, version: { $inc: 1 } }
    );

    // Check for duplicate room usage
    const roomUsage = new Map();
    for (const entry of validatedEntries) {
      const key = `${entry.day}-${entry.roomId.toString()}-${entry.startTime}-${entry.endTime}`;
      if (roomUsage.has(key)) {
        const room = await Room.findById(entry.roomId);
        return res.status(400).json({
          success: false, message: `Room ${room?.name} is already used at ${entry.day} ${entry.startTime}-${entry.endTime}`
        });
      }
      roomUsage.set(key, true);
    }

    // Check for faculty conflicts
    for (const entry of validatedEntries) {
      const existing = await Timetable.findOne({
        department, semester, section, isActive: true,
        faculty: entry.faculty, day: entry.day,
        startTime: { $lt: entry.endTime }, endTime: { $gt: entry.startTime }
      });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Faculty ${entry.faculty} already has a class at ${entry.day} ${entry.startTime}-${entry.endTime}`
        });
      }
    }

    const createdEntries = await Timetable.insertMany(validatedEntries);

    // Cancel conflicting bookings with socket notifications
    const cancelledBookings = await cancelConflictingBookings(createdEntries, department);

    res.status(201).json({
      success: true,
      message: `Timetable for ${department} department updated successfully`,
      data: {
        entriesAdded: createdEntries.length,
        bookingsCancelled: cancelledBookings.length,
        entries: createdEntries,
        cancelledBookings: cancelledBookings.map(b => ({
          id: b.id, room: b.roomId.name, date: b.date,
          time: `${b.startTime} - ${b.endTime}`, purpose: b.purpose,
          facultyName: b.facultyName, reason: b.conflictMessage,
          notified: b.notified
        }))
      }
    });
  } catch (error) {
    console.error('Create timetable error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update timetable entry (HOD only) – with conflict handling
app.put('/api/timetable/:id', protect, authorize('HOD'), async (req, res) => {
  try {
    const { id } = req.params;
    const { startTime, endTime, subject, roomId, classGroup, faculty } = req.body;

    const entry = await Timetable.findById(id);
    if (!entry) return res.status(404).json({ success: false, message: 'Timetable entry not found' });

    if (req.user.department !== entry.department) {
      return res.status(403).json({ success: false, message: `You can only update timetable for your own department` });
    }

    if (startTime && endTime && startTime >= endTime) {
      return res.status(400).json({ success: false, message: 'Start time must be before end time' });
    }

    if (roomId && roomId !== entry.roomId.toString()) {
      const room = await Room.findById(roomId);
      if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
      if (room.department !== entry.department) {
        return res.status(400).json({ success: false, message: `Room ${room.name} does not belong to ${entry.department} department` });
      }

      const existingEntry = await Timetable.findOne({
        roomId, day: entry.day, isActive: true,
        startTime: { $lt: endTime || entry.endTime },
        endTime: { $gt: startTime || entry.startTime },
        _id: { $ne: id }
      });
      if (existingEntry) {
        return res.status(400).json({ success: false, message: 'Room is already booked for this time slot' });
      }
      entry.roomId = roomId;
    }

    if (startTime) entry.startTime = startTime;
    if (endTime) entry.endTime = endTime;
    if (subject) entry.subject = subject;
    if (classGroup) entry.classGroup = classGroup;
    if (faculty) entry.faculty = faculty;

    entry.version += 1;
    await entry.save();

    // After saving, check if this updated entry conflicts with any active booking
    const updatedEntry = await Timetable.findById(id).populate('roomId');
    if (updatedEntry && updatedEntry.isActive) {
      // Find all active bookings for the same department
      const activeBookings = await Booking.find({
        department: updatedEntry.department,
        status: 'active'
      }).populate('roomId');

      const bookingsToCancel = [];
      for (const booking of activeBookings) {
        const bookingDay = getDayOfWeek(booking.date);
        if (bookingDay === updatedEntry.day &&
            booking.roomId._id.toString() === updatedEntry.roomId._id.toString() &&
            isOverlapping(booking.startTime, booking.endTime, updatedEntry.startTime, updatedEntry.endTime)) {
          bookingsToCancel.push(booking);
        }
      }

      for (const booking of bookingsToCancel) {
        booking.status = 'cancelled';
        booking.conflictMessage = `Room ${booking.roomId.name} is now scheduled for ${updatedEntry.subject} from ${updatedEntry.startTime} to ${updatedEntry.endTime}`;
        await booking.save();

        try {
          await sendBookingCancellationEmail(booking, booking.conflictMessage);
          booking.notified = true;
          await booking.save();
        } catch (emailError) {
          console.error('Failed to send cancellation email:', emailError.message);
        }

        const facultyUser = await User.findOne({ email: booking.facultyEmail });
        if (facultyUser) {
          emitToUser(facultyUser._id.toString(), 'booking-cancelled', {
            bookingId: booking.id,
            roomName: booking.roomId.name,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            reason: booking.conflictMessage,
          });
        }
      }
    }

    res.json({ success: true, message: 'Timetable entry updated successfully', data: entry });
  } catch (error) {
    console.error('Update timetable entry error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete timetable entry (HOD only) – soft delete (no conflicts arise)
app.delete('/api/timetable/:id', protect, authorize('HOD'), async (req, res) => {
  try {
    const entry = await Timetable.findById(req.params.id);
    if (!entry) return res.status(404).json({ success: false, message: 'Timetable entry not found' });

    if (req.user.department !== entry.department) {
      return res.status(403).json({ success: false, message: `You can only delete timetable for your own department` });
    }

    entry.isActive = false;
    await entry.save();

    res.json({ success: true, message: 'Timetable entry deleted successfully' });
  } catch (error) {
    console.error('Delete timetable entry error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ============================================
// BOOKING ROUTES - Enhanced (unchanged)
// ============================================

// Get all bookings
app.get('/api/bookings', protect, async (req, res) => {
  try {
    const { status, department, date, facultyEmail } = req.query;
    const query = {};
    if (status) query.status = status;
    if (department) query.department = department;
    if (date) query.date = date;
    if (facultyEmail) query.facultyEmail = facultyEmail;

    if (req.user.role === 'HOD') {
      // HOD can see all bookings of their department
      if (!department) query.department = req.user.department;
    } else {
      // Faculty can only see their own bookings
      query.facultyEmail = req.user.email;
    }

    const bookings = await Booking.find(query)
      .populate('roomId', 'name roomNumber floor building')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get my bookings
app.get('/api/bookings/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ facultyEmail: req.user.email })
      .populate('roomId', 'name roomNumber floor building')
      .sort({ date: -1, startTime: -1 });
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get booking by ID
app.get('/api/bookings/:id', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('roomId', 'name roomNumber floor building');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.facultyEmail !== req.user.email && req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking' });
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create booking
app.post('/api/bookings', protect, async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, purpose, comment } = req.body;

    if (!roomId || !date || !startTime || !endTime || !purpose) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (startTime >= endTime) {
      return res.status(400).json({ success: false, message: 'End time must be after start time' });
    }

    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const durationMinutes = (eH * 60 + eM) - (sH * 60 + sM);
    if (durationMinutes < 30) {
      return res.status(400).json({ success: false, message: 'Booking must be at least 30 minutes' });
    }

    const bookingDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return res.status(400).json({ success: false, message: 'Cannot book in the past' });
    }

    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 7);
    if (bookingDate > maxDate) {
      return res.status(400).json({ success: false, message: 'Cannot book more than 7 days in advance' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    if (!room.isAvailable) {
      return res.status(400).json({ success: false, message: 'Room is currently unavailable' });
    }

    const day = getDayOfWeek(date);

    // Check if user already has a booking at this time
    const userExistingBooking = await Booking.findOne({
      facultyEmail: req.user.email, date,
      startTime: { $lt: endTime }, endTime: { $gt: startTime }, status: 'active'
    });
    if (userExistingBooking) {
      return res.status(409).json({ success: false, message: 'You already have a booking at this time' });
    }

    // Check for conflicting bookings
    const conflictingBooking = await Booking.findOne({
      roomId, date, startTime: { $lt: endTime }, endTime: { $gt: startTime }, status: 'active'
    });
    if (conflictingBooking) {
      return res.status(409).json({ success: false, message: `Room is already booked for this time slot`, conflict: true });
    }

    // Check for timetable conflicts
    const timetableConflict = await Timetable.findOne({
      roomId, day, startTime: { $lt: endTime }, endTime: { $gt: startTime }, isActive: true
    });
    if (timetableConflict) {
      return res.status(409).json({
        success: false,
        message: `Room is scheduled for ${timetableConflict.subject} from ${timetableConflict.startTime} to ${timetableConflict.endTime}`,
        conflict: true,
        timetableConflict
      });
    }

    const booking = await Booking.create({
      roomId, date, day, startTime, endTime, purpose,
      comment: comment || 'No comment provided',
      facultyName: req.user.name, facultyEmail: req.user.email,
      department: req.user.department, status: 'active'
    });

    const populated = await booking.populate('roomId', 'name roomNumber floor building');

    try {
      await sendBookingConfirmationEmail(booking);
      booking.notified = true;
      await booking.save();
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError.message);
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Cancel booking
app.put('/api/bookings/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('roomId', 'name');
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    
    if (booking.facultyEmail !== req.user.email && req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }
    if (booking.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Completed bookings cannot be cancelled' });
    }

    const bookingDate = new Date(booking.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (bookingDate < today) {
      return res.status(400).json({ success: false, message: 'Cannot cancel past bookings' });
    }
    
    booking.status = 'cancelled';
    await booking.save();

    try {
      await sendBookingCancellationEmail(booking, 'Cancelled by user');
      booking.notified = true;
      await booking.save();
    } catch (emailError) {
      console.error('Failed to send cancellation email:', emailError.message);
    }

    res.json({ success: true, message: 'Booking cancelled', data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Lock room for booking
app.post('/api/bookings/lock', protect, async (req, res) => {
  try {
    const { roomId, date, startTime, endTime } = req.body;
    if (!roomId || !date || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: 'roomId, date, startTime and endTime are required' });
    }

    const day = getDayOfWeek(date);
    const lockId = generateLockId();

    const existingLock = await Booking.findOne({
      roomId, date, startTime, endTime, lockedAt: { $exists: true, $ne: null }
    });
    if (existingLock) {
      return res.status(409).json({ success: false, message: 'Room is currently being booked by another user' });
    }

    const lock = await Booking.create({
      roomId, facultyName: req.user.name, facultyEmail: req.user.email,
      department: req.user.department, date, day, startTime, endTime,
      purpose: 'LOCKED', comment: 'Room locked for booking',
      status: 'active', lockId, lockedAt: new Date()
    });

    res.json({ success: true, message: 'Room locked successfully', lockId, expiresIn: '5 minutes', data: lock });
  } catch (error) {
    console.error('Lock room error:', error);
    res.status(500).json({ success: false, message: 'Failed to lock room', error: error.message });
  }
});

// Unlock room
app.post('/api/bookings/unlock', protect, async (req, res) => {
  try {
    const { lockId } = req.body;
    if (!lockId) return res.status(400).json({ success: false, message: 'lockId is required' });

    const booking = await Booking.findOne({ lockId });
    if (!booking) return res.status(404).json({ success: false, message: 'Lock not found' });

    if (booking.facultyEmail !== req.user.email && req.user.role !== 'HOD') {
      return res.status(403).json({ success: false, message: 'You do not have permission to unlock this room' });
    }

    await Booking.deleteOne({ lockId });
    res.json({ success: true, message: 'Room unlocked successfully' });
  } catch (error) {
    console.error('Unlock room error:', error);
    res.status(500).json({ success: false, message: 'Failed to unlock room', error: error.message });
  }
});

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏫 Room Allocation System API (TESTING MODE – bcrypt & email disabled, only @gmail.com)',
    version: '2.0.0-test-gmail',
    endpoints: {
      auth: ['POST /api/auth/login', 'POST /api/auth/signup', 'POST /api/auth/forgot-password', 'POST /api/auth/verify-reset-otp', 'POST /api/auth/reset-password', 'POST /api/auth/change-password', 'GET /api/auth/me'],
      rooms: ['GET /api/rooms (with filters)', 'GET /api/rooms/:id', 'GET /api/rooms/available (with filters)', 'GET /api/rooms/floors', 'GET /api/rooms/buildings', 'POST /api/rooms (HOD only)', 'PUT /api/rooms/:id (HOD only)', 'PUT /api/rooms/:id/toggle (HOD only)', 'DELETE /api/rooms/:id (HOD only)', 'GET /api/rooms/:roomId/availability'],
      timetable: ['GET /api/timetable', 'GET /api/timetable/department/:dept', 'GET /api/timetable/faculty/:name', 'GET /api/timetable/room/:roomId', 'POST /api/timetable (HOD only)', 'PUT /api/timetable/:id (HOD only)', 'DELETE /api/timetable/:id (HOD only)'],
      bookings: ['GET /api/bookings', 'GET /api/bookings/my', 'GET /api/bookings/:id', 'POST /api/bookings', 'PUT /api/bookings/:id/cancel', 'POST /api/bookings/lock', 'POST /api/bookings/unlock']
    }
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, message: err.message });
});

// Use server.listen instead of app.listen to support Socket.IO
server.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT} (TESTING MODE – only @gmail.com)`);
  console.log(`📡 Socket.IO server attached`);
  console.log(`📧 Email sending DISABLED – OTPs are printed to console.`);
  console.log(`🔐 Password hashing DISABLED – passwords stored in plain text.`);
  console.log(`📧 Allowed domains: @gmail.com only`);
  console.log(`\n📋 API Endpoints:`);
  console.log(`   ─────────────────────────────`);
  console.log(`   🔐 AUTH:`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   POST   /api/auth/signup`);
  console.log(`   POST   /api/auth/forgot-password`);
  console.log(`   POST   /api/auth/verify-reset-otp`);
  console.log(`   POST   /api/auth/reset-password`);
  console.log(`   POST   /api/auth/change-password`);
  console.log(`   GET    /api/auth/me`);
  console.log(`   ─────────────────────────────`);
  console.log(`   🏢 ROOMS (with filters):`);
  console.log(`   GET    /api/rooms (dept, floor, building, search, etc.)`);
  console.log(`   GET    /api/rooms/:id`);
  console.log(`   GET    /api/rooms/available (with filters)`);
  console.log(`   GET    /api/rooms/floors`);
  console.log(`   GET    /api/rooms/buildings`);
  console.log(`   POST   /api/rooms (HOD only)`);
  console.log(`   PUT    /api/rooms/:id (HOD only)`);
  console.log(`   PUT    /api/rooms/:id/toggle (HOD only)`);
  console.log(`   DELETE /api/rooms/:id (HOD only)`);
  console.log(`   GET    /api/rooms/:roomId/availability`);
  console.log(`   ─────────────────────────────`);
  console.log(`   📅 TIMETABLE:`);
  console.log(`   GET    /api/timetable (dept, semester, section, day, faculty)`);
  console.log(`   GET    /api/timetable/department/:dept`);
  console.log(`   GET    /api/timetable/faculty/:name`);
  console.log(`   GET    /api/timetable/room/:roomId`);
  console.log(`   POST   /api/timetable (HOD only) — REPLACES entire timetable`);
  console.log(`   PUT    /api/timetable/:id (HOD only)`);
  console.log(`   DELETE /api/timetable/:id (HOD only)`);
  console.log(`   ─────────────────────────────`);
  console.log(`   📋 BOOKINGS:`);
  console.log(`   GET    /api/bookings (status, dept, date, facultyEmail)`);
  console.log(`   GET    /api/bookings/my`);
  console.log(`   GET    /api/bookings/:id`);
  console.log(`   POST   /api/bookings`);
  console.log(`   PUT    /api/bookings/:id/cancel`);
  console.log(`   POST   /api/bookings/lock`);
  console.log(`   POST   /api/bookings/unlock`);
  console.log(`   ─────────────────────────────\n`);
});*/






require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./utils/socket');

const PORT = parseInt(process.env.PORT, 10) || 3000;

// ---------- GLOBAL PROCESS ERROR HANDLERS ----------
process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down server...', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('💥 UNHANDLED PROMISE REJECTION! Shutting down server...', err);
  process.exit(1);
});

// ---------- BOOTSTRAP APPLICATION ----------
async function startServer() {
  try {
    // 1. Connect to MongoDB Database
    await connectDB();

    // 2. Create HTTP Server Instance
    const server = http.createServer(app);

    // 3. Attach Socket.IO to HTTP Server
    initSocket(server);

    // 4. Start Listening on Configured Port
    server.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 NIT Raipur Room Allocation API Server Running`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`🔌 Socket.IO: Initialized and attached`);
      console.log(`🔐 Authentication: JWT (7d expiry) with Bcrypt hashing`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`======================================================\n`);
    });
  } catch (err) {
    console.error('❌ Failed to initialize server:', err.message);
    process.exit(1);
  }
}

startServer();