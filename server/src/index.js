const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

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

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ============================================
// SCHEMAS / MODELS
// ============================================

// 1. USER SCHEMA
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { 
    type: String, 
    required: true, 
    unique: true, 
    lowercase: true, 
    trim: true,
    match: [/^[a-zA-Z0-9._%+-]+@nitrr\.ac\.in$/, 'Please use a valid @nitrr.ac.in email']
  },
  password: { type: String, required: true, minlength: 8, select: false },
  role: { type: String, enum: ['FACULTY', 'HOD'], required: true },
  department: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

UserSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

UserSchema.statics.isValidEmail = function(email) {
  return /^[a-zA-Z0-9._%+-]+@nitrr\.ac\.in$/.test(email);
};

UserSchema.statics.detectRole = function(email) {
  const localPart = email.split('@')[0];
  if (localPart.startsWith('hod.') || localPart.startsWith('head.') || localPart === 'hod') {
    return 'HOD';
  }
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

// 2. ROOM SCHEMA
const RoomSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  capacity: { type: Number, required: true, min: 1 },
  type: { type: String, enum: ['Classroom', 'Lab', 'Auditorium', 'Lecture Hall'], required: true },
  floor: { type: String, required: true },
  isActive: { type: Boolean, default: true },
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

// 3. TIMETABLE SCHEMA
const TimetableSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  subject: { type: String, required: true, trim: true },
  classGroup: { type: String, required: true, trim: true },
  faculty: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
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

// 4. BOOKING SCHEMA
const BookingSchema = new mongoose.Schema({
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
  date: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  facultyName: { type: String, required: true, trim: true },
  facultyEmail: { type: String, required: true, trim: true },
  purpose: { type: String, required: true, trim: true },
  status: { type: String, enum: ['active', 'cancelled', 'completed'], default: 'active' },
}, { timestamps: true });

BookingSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  }
});

const Booking = mongoose.model('Booking', BookingSchema);

// 5. OTP SCHEMA (for future use)
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
      return res.status(401).json({ 
        success: false, 
        message: 'Not authorized, no token' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
};

// ============================================
// AUTH ROUTES
// ============================================

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`🔑 Login attempt for: ${email}`);

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password required' 
      });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    await user.updateLastLogin();
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// SIGNUP
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, confirmPassword, department } = req.body;
    console.log(`📝 Signup attempt for: ${email}`);

    if (!name || !email || !password || !confirmPassword || !department) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Passwords do not match' 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 8 characters' 
      });
    }

    if (!User.isValidEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Only @nitrr.ac.in email addresses are allowed' 
      });
    }

    const role = User.detectRole(email);

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this email' 
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      department,
      isActive: true
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'User already exists with this email' 
      });
    }
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// FORGOT PASSWORD
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`🔐 Forgot password for: ${email}`);

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required' 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'No account found with this email' 
      });
    }

    res.json({
      success: true,
      message: 'Password reset instructions sent to your email'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// GET CURRENT USER
app.get('/api/auth/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// ============================================
// ROOM ROUTES
// ============================================

// Get all rooms
app.get('/api/rooms', protect, async (req, res) => {
  try {
    const rooms = await Room.find({ isActive: true });
    res.json({ success: true, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get room by ID
app.get('/api/rooms/:id', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.json({ success: true, data: room });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create room (HOD only)
app.post('/api/rooms', protect, async (req, res) => {
  try {
    if (req.user.role !== 'HOD') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only HOD can create rooms' 
      });
    }
    const room = await Room.create(req.body);
    res.status(201).json({ success: true, data: room });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update room (HOD only)
app.put('/api/rooms/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'HOD') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only HOD can update rooms' 
      });
    }
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.json({ success: true, data: room });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete room (HOD only)
app.delete('/api/rooms/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'HOD') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only HOD can delete rooms' 
      });
    }
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) {
      return res.status(404).json({ success: false, message: 'Room not found' });
    }
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Get room availability
app.get('/api/rooms/:roomId/availability', protect, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { day, time } = req.query;

    if (!day || !time) {
      return res.status(400).json({ 
        success: false, 
        message: 'Day and time required' 
      });
    }

    const ttClash = await Timetable.findOne({
      roomId,
      day,
      startTime: { $lte: time },
      endTime: { $gt: time },
      isActive: true
    });

    if (ttClash) {
      return res.json({
        success: true,
        available: false,
        reason: 'Timetable class',
        details: {
          subject: ttClash.subject,
          classGroup: ttClash.classGroup,
          faculty: ttClash.faculty,
          until: ttClash.endTime
        }
      });
    }

    const bookingClash = await Booking.findOne({
      roomId,
      date: new Date().toISOString().split('T')[0],
      startTime: { $lte: time },
      endTime: { $gt: time },
      status: 'active'
    });

    if (bookingClash) {
      return res.json({
        success: true,
        available: false,
        reason: 'Booking',
        details: {
          purpose: bookingClash.purpose,
          facultyName: bookingClash.facultyName,
          until: bookingClash.endTime
        }
      });
    }

    res.json({
      success: true,
      available: true,
      message: 'Room is available'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// TIMETABLE ROUTES
// ============================================

// Get all timetable entries
app.get('/api/timetable', protect, async (req, res) => {
  try {
    const entries = await Timetable.find({ isActive: true }).populate('roomId', 'name');
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get timetable by department
app.get('/api/timetable/department/:department', protect, async (req, res) => {
  try {
    const { department } = req.params;
    const entries = await Timetable.find({ 
      department, 
      isActive: true 
    }).populate('roomId', 'name');
    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create timetable entry (HOD only)
app.post('/api/timetable', protect, async (req, res) => {
  try {
    if (req.user.role !== 'HOD') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only HOD can manage timetable' 
      });
    }
    const entry = await Timetable.create(req.body);
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Update timetable entry (HOD only)
app.put('/api/timetable/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'HOD') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only HOD can update timetable' 
      });
    }
    const entry = await Timetable.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }
    res.json({ success: true, data: entry });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Delete timetable entry (HOD only)
app.delete('/api/timetable/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'HOD') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only HOD can delete timetable entries' 
      });
    }
    const entry = await Timetable.findByIdAndDelete(req.params.id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Timetable entry not found' });
    }
    res.json({ success: true, message: 'Timetable entry deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// ============================================
// BOOKING ROUTES
// ============================================

// Get all bookings
app.get('/api/bookings', protect, async (req, res) => {
  try {
    const bookings = await Booking.find().populate('roomId', 'name');
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get my bookings
app.get('/api/bookings/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ 
      facultyEmail: req.user.email 
    }).populate('roomId', 'name');
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create booking
app.post('/api/bookings', protect, async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, purpose } = req.body;

    if (!roomId || !date || !startTime || !endTime || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if room exists
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Check for conflicting bookings
    const conflictingBooking = await Booking.findOne({
      roomId,
      date,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      status: 'active'
    });

    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        message: 'Room is already booked for this time slot'
      });
    }

    // Check for timetable conflicts
    const day = getDayOfWeek(date);
    const timetableConflict = await Timetable.findOne({
      roomId,
      day,
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
      isActive: true
    });

    if (timetableConflict) {
      return res.status(409).json({
        success: false,
        message: `Room is scheduled for ${timetableConflict.subject} from ${timetableConflict.startTime} to ${timetableConflict.endTime}`
      });
    }

    const booking = await Booking.create({
      roomId,
      date,
      startTime,
      endTime,
      purpose,
      facultyName: req.user.name,
      facultyEmail: req.user.email,
      status: 'active'
    });

    const populated = await booking.populate('roomId', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// Cancel booking
app.put('/api/bookings/:id/cancel', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found' 
      });
    }
    
    if (booking.facultyEmail !== req.user.email && req.user.role !== 'HOD') {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized to cancel this booking' 
      });
    }
    
    booking.status = 'cancelled';
    await booking.save();
    res.json({ success: true, message: 'Booking cancelled', data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// SEED INITIAL DATA (For testing)
// ============================================
app.post('/api/seed', async (req, res) => {
  try {
    await Room.deleteMany({});
    await Timetable.deleteMany({});
    await Booking.deleteMany({});

    const rooms = await Room.insertMany([
      { name: 'CS-101 (Lecture Hall)', capacity: 70, type: 'Lecture Hall', floor: '1st Floor' },
      { name: 'CS-102 (Smart Classroom)', capacity: 60, type: 'Classroom', floor: '1st Floor' },
      { name: 'CS-Lab A (Network Lab)', capacity: 35, type: 'Lab', floor: 'Ground Floor' },
      { name: 'Seminar Hall (Main)', capacity: 120, type: 'Auditorium', floor: '2nd Floor' }
    ]);

    await Timetable.insertMany([
      { roomId: rooms[0]._id, day: 'Wednesday', startTime: '09:00', endTime: '10:00', 
        subject: 'Data Structures', classGroup: 'CS-3A', faculty: 'Dr. D. S. Sisodia' },
      { roomId: rooms[0]._id, day: 'Wednesday', startTime: '10:00', endTime: '11:00', 
        subject: 'Operating Systems', classGroup: 'CS-5B', faculty: 'Prof. R. Verma' },
      { roomId: rooms[1]._id, day: 'Wednesday', startTime: '11:15', endTime: '12:15', 
        subject: 'Database Systems', classGroup: 'CS-4A', faculty: 'Dr. P. Sharma' }
    ]);

    await Booking.create({
      roomId: rooms[2]._id,
      date: new Date().toISOString().split('T')[0],
      startTime: '14:00',
      endTime: '15:00',
      facultyName: 'Prof. Rajesh Verma',
      facultyEmail: 'rverma.cs@nitrr.ac.in',
      purpose: 'Remedial Doubt Session',
      status: 'active'
    });

    res.json({ 
      success: true, 
      message: '✅ Seed data created successfully',
      data: { rooms: rooms.length, timetable: 3, bookings: 1 }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    message: '🏫 Room Allocation System API', 
    version: '1.0.0',
    endpoints: {
      auth: ['POST /api/auth/login', 'POST /api/auth/signup', 'POST /api/auth/forgot-password', 'GET /api/auth/me'],
      rooms: ['GET /api/rooms', 'GET /api/rooms/:id', 'POST /api/rooms', 'PUT /api/rooms/:id', 'DELETE /api/rooms/:id', 'GET /api/rooms/:roomId/availability'],
      timetable: ['GET /api/timetable', 'GET /api/timetable/department/:department', 'POST /api/timetable', 'PUT /api/timetable/:id', 'DELETE /api/timetable/:id'],
      bookings: ['GET /api/bookings', 'GET /api/bookings/my', 'POST /api/bookings', 'PUT /api/bookings/:id/cancel'],
      seed: ['POST /api/seed']
    }
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, message: err.message });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📧 Allowed: @nitrr.ac.in only`);
  console.log(`\n📋 API Endpoints:`);
  console.log(`   ─────────────────────────────`);
  console.log(`   🔐 AUTH:`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   POST   /api/auth/signup`);
  console.log(`   POST   /api/auth/forgot-password`);
  console.log(`   GET    /api/auth/me`);
  console.log(`   ─────────────────────────────`);
  console.log(`   🏢 ROOMS:`);
  console.log(`   GET    /api/rooms`);
  console.log(`   GET    /api/rooms/:id`);
  console.log(`   POST   /api/rooms (HOD only)`);
  console.log(`   PUT    /api/rooms/:id (HOD only)`);
  console.log(`   DELETE /api/rooms/:id (HOD only)`);
  console.log(`   GET    /api/rooms/:roomId/availability`);
  console.log(`   ─────────────────────────────`);
  console.log(`   📅 TIMETABLE:`);
  console.log(`   GET    /api/timetable`);
  console.log(`   GET    /api/timetable/department/:dept`);
  console.log(`   POST   /api/timetable (HOD only)`);
  console.log(`   PUT    /api/timetable/:id (HOD only)`);
  console.log(`   DELETE /api/timetable/:id (HOD only)`);
  console.log(`   ─────────────────────────────`);
  console.log(`   📋 BOOKINGS:`);
  console.log(`   GET    /api/bookings`);
  console.log(`   GET    /api/bookings/my`);
  console.log(`   POST   /api/bookings`);
  console.log(`   PUT    /api/bookings/:id/cancel`);
  console.log(`   ─────────────────────────────`);
  console.log(`   🌱 SEED:`);
  console.log(`   POST   /api/seed`);
  console.log(`   ─────────────────────────────\n`);
});