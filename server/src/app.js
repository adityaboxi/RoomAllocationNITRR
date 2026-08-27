const express = require('express');
const cors = require('cors');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const statsRoutes = require('./routes/statsRoutes');

// Middleware Imports
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// ---------- GLOBAL MIDDLEWARES ----------
const allowedOrigin = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ---------- REST API ROUTES ----------
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stats', statsRoutes);

// ---------- HEALTH CHECK & API INFO ----------
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏫 Room Allocation System API — NIT Raipur',
    version: '2.1.0',
    endpoints: {
      auth: [
        'POST /api/auth/login',
        'POST /api/auth/signup',
        'POST /api/auth/send-signup-otp',
        'POST /api/auth/verify-signup-otp',
        'POST /api/auth/forgot-password',
        'POST /api/auth/verify-reset-otp',
        'POST /api/auth/reset-password',
        'POST /api/auth/change-password',
        'GET /api/auth/me',
      ],
      rooms: [
        'GET /api/rooms',
        'GET /api/rooms/:id',
        'GET /api/rooms/available',
        'GET /api/rooms/floors',
        'GET /api/rooms/buildings',
        'GET /api/rooms/department/:department',
        'POST /api/rooms (HOD only)',
        'PUT /api/rooms/:id (HOD only)',
        'PUT /api/rooms/:id/toggle (HOD only)',
        'DELETE /api/rooms/:id (HOD only)',
        'GET /api/rooms/:roomId/availability',
      ],
      timetable: [
        'GET /api/timetable',
        'GET /api/timetable/department/:dept',
        'GET /api/timetable/faculty/:name',
        'GET /api/timetable/room/:roomId',
        'POST /api/timetable (HOD only)',
        'POST /api/timetable/upload (HOD only)',
        'PUT /api/timetable/:id (HOD only)',
        'DELETE /api/timetable/:id (HOD only)',
      ],
      bookings: [
        'GET /api/bookings',
        'GET /api/bookings/my',
        'GET /api/bookings/:id',
        'GET /api/bookings/room/:roomId',
        'GET /api/bookings/faculty/:facultyEmail',
        'POST /api/bookings',
        'PUT /api/bookings/:id/cancel',
        'POST /api/bookings/lock',
        'POST /api/bookings/unlock',
      ],
      notifications: [
        'GET /api/notifications',
        'PUT /api/notifications/:id/read',
        'PUT /api/notifications/read-all',
        'DELETE /api/notifications/:id',
        'DELETE /api/notifications',
      ],
      reviews: [
        'GET /api/reviews/pending',
        'GET /api/reviews/my',
        'GET /api/reviews/room/:roomId',
        'POST /api/reviews',
      ],
      stats: [
        'GET /api/stats/department/:department',
      ],
    },
  });
});

// ---------- 404 UNMAPPED ROUTE HANDLER ----------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// ---------- CENTRALIZED ERROR HANDLER ----------
app.use(errorHandler);

module.exports = app;