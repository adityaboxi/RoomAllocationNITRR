const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { connectDB } = require('./config/database');
const { redisClient } = require('./config/redis');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 4,
  message: { success: false, error: 'Too many requests', message: 'Maximum 4 requests per second.' }
});

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(limiter);

// Connect to DBs
connectDB();
redisClient.connect();

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/timetable', require('./routes/timetableRoutes'));

// Health check
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = { 0: 'Disconnected', 1: 'Connected', 2: 'Connecting', 3: 'Disconnecting' };
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: statusMap[dbStatus] || 'Unknown',
    redis: redisClient.isReady() ? 'Connected' : 'Disconnected',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    rateLimit: `${process.env.RATE_LIMIT_MAX || 4} requests/second`,
    allowedDomain: `@${process.env.ALLOWED_EMAIL_DOMAIN || 'gmail.com'}`
  });
});

app.get('/', (req, res) => {
  res.json({ success: true, message: '🏫 Room Allocation System API - NIT Raipur', version: '1.0.0', status: 'Running' });
});

// Error handling
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? err.message : undefined });
});

// Seed data
const seedData = async () => {
  try {
    const User = require('./models/User');
    const Room = require('./models/Room');
    const count = await User.countDocuments();
    if (count === 0) {
      console.log('🌱 Seeding initial data...');
      const adminEmail = process.env.ADMIN_EMAIL || 'adityaboxi2005@gmail.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'Hod@12345';
      await User.create({ name: process.env.ADMIN_NAME || 'Dr. Aditya Boxi', email: adminEmail, password: adminPassword, role: 'hod', department: process.env.ADMIN_DEPARTMENT || 'CSE', employeeId: process.env.ADMIN_EMPLOYEE_ID || 'HOD001', phone: process.env.ADMIN_PHONE || '9876543210', isEmailVerified: true, hodApproval: 'approved' });
      console.log(`✅ Admin created: ${adminEmail}`);

      const profEmail = process.env.PROF_EMAIL || 'prof@gmail.com';
      const profPassword = process.env.PROF_PASSWORD || 'Prof@12345';
      await User.create({ name: process.env.PROF_NAME || 'Dr. Priya Sharma', email: profEmail, password: profPassword, role: 'professor', department: process.env.PROF_DEPARTMENT || 'CSE', employeeId: process.env.PROF_EMPLOYEE_ID || 'PROF001', phone: process.env.PROF_PHONE || '9876543211', isEmailVerified: true, hodApproval: 'approved' });
      console.log(`✅ Professor created: ${profEmail}`);

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
      console.log('✅ Rooms created!');
      console.log(`\n📋 Demo Accounts:\n  ADMIN: ${adminEmail} / ${adminPassword}\n  Professor: ${profEmail} / ${profPassword}`);
    }
  } catch (error) {
    console.error('❌ Seed error:', error.message);
  }
};

setTimeout(seedData, 2000);

app.listen(PORT, () => {
  console.log(`\n========================================\n🚀 Room Allocation System Server\n========================================\n📍 Server running on: http://localhost:${PORT}\n📧 Allowed Domain: @${process.env.ALLOWED_EMAIL_DOMAIN || 'gmail.com'}\n⏱️  Rate Limit: ${process.env.RATE_LIMIT_MAX || 4} requests/second\n========================================\n📋 Admin: ${process.env.ADMIN_EMAIL || 'adityaboxi2005@gmail.com'} / ${process.env.ADMIN_PASSWORD || 'Hod@12345'}\n========================================\n`);
});

module.exports = app;
