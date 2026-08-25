
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
const { connectDB } = require('./config/database');

// Connect to database (will retry internally)
connectDB();

// ============================================
// ROUTES
// ============================================
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const timetableRoutes = require('./routes/timetableRoutes');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/timetable', timetableRoutes);

// ============================================
// HEALTH CHECK
// ============================================
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const statusMap = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: statusMap[dbStatus] || 'Unknown',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    rateLimit: `${process.env.RATE_LIMIT_MAX || 4} requests/second`,
    allowedDomain: `@${process.env.ALLOWED_EMAIL_DOMAIN || 'nitrr.ac.in'}`
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏫 Room Allocation System API - NIT Raipur',
    version: '1.0.0',
    status: 'Running'
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
    const User = require('./models/User');
    const Room = require('./models/Room');
    
    const count = await User.countDocuments();
    if (count === 0) {
      console.log('🌱 Seeding initial data...');
      
      const adminEmail = process.env.ADMIN_EMAIL || 'hod@gmail.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'Hod@12345';
      const adminName = process.env.ADMIN_NAME || 'Dr. HOD Singh';
      const adminDepartment = process.env.ADMIN_DEPARTMENT || 'CSE';
      const adminEmployeeId = process.env.ADMIN_EMPLOYEE_ID || 'HOD001';
      const adminPhone = process.env.ADMIN_PHONE || '9876543210';

      await User.create({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'hod',
        department: adminDepartment,
        employeeId: adminEmployeeId,
        phone: adminPhone,
        isEmailVerified: true,
        hodApproval: 'approved'
      });

      console.log(`✅ Admin created: ${adminEmail}`);

      const profEmail = process.env.PROF_EMAIL || 'prof@gmail.com';
      const profPassword = process.env.PROF_PASSWORD || 'Prof@12345';
      const profName = process.env.PROF_NAME || 'Dr. Priya Sharma';
      const profDepartment = process.env.PROF_DEPARTMENT || 'CSE';
      const profEmployeeId = process.env.PROF_EMPLOYEE_ID || 'PROF001';
      const profPhone = process.env.PROF_PHONE || '9876543211';

      await User.create({
        name: profName,
        email: profEmail,
        password: profPassword,
        role: 'professor',
        department: profDepartment,
        employeeId: profEmployeeId,
        phone: profPhone,
        isEmailVerified: true,
        hodApproval: 'approved'
      });

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

      console.log('✅ Rooms created successfully!');
      console.log('\n========================================');
      console.log('✅ SEED DATA CREATED SUCCESSFULLY!');
      console.log('========================================');
      console.log('📋 Demo Accounts:');
      console.log(`  ADMIN/HOD: ${adminEmail} / ${adminPassword}`);
      console.log(`  Professor: ${profEmail} / ${profPassword}`);
      console.log('========================================\n');
    }
  } catch (error) {
    console.error('❌ Seed error:', error.message);
  }
};

// Run seed after database connection
setTimeout(() => {
  seedData();
}, 2000);

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🚀 Room Allocation System Server');
  console.log('========================================');
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`📧 Allowed Domain: @${process.env.ALLOWED_EMAIL_DOMAIN || 'nitrr.ac.in'}`);
  console.log(`⏱️  Rate Limit: ${process.env.RATE_LIMIT_MAX || 4} requests/second`);
  console.log('========================================');
  console.log('📋 Admin Credentials (from .env):');
  console.log(`  Email: ${process.env.ADMIN_EMAIL || 'hod@gmail.com'}`);
  console.log(`  Password: ${process.env.ADMIN_PASSWORD || 'Hod@12345'}`);
  console.log('========================================\n');
});

module.exports = app;
