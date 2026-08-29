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
const holidayRoutes = require('./routes/holidayRoutes');

// Middleware Imports
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

// ---------- GLOBAL CORS CONFIGURATION (Dynamic from .env) ----------
const allowedOrigins = (
  process.env.CORS_ORIGIN ||
  process.env.CLIENT_URL ||
  'http://localhost:5173'
)
  .split(',')
  .map((url) => url.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as server-to-server, mobile apps, or Postman)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body Parsing Middlewares
const bodyLimit = process.env.BODY_LIMIT || '10mb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// ---------- REST API ROUTES ----------
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/holidays', holidayRoutes);

// ---------- HEALTH CHECK & ROOT DIRECTORY ----------
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏫 Room Allocation & Master Scheduling System API — NIT Raipur',
    version: '2.2.0',
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
        'GET /api/rooms/:roomId/availability',
        'POST /api/rooms',
        'PUT /api/rooms/:id',
        'PUT /api/rooms/:id/toggle',
        'DELETE /api/rooms/:id',
      ],
      timetable: [
        'GET /api/timetable',
        'GET /api/timetable/department/:department',
        'GET /api/timetable/faculty/:facultyName',
        'GET /api/timetable/room/:roomId',
        'POST /api/timetable',
        'POST /api/timetable/room-day',
        'POST /api/timetable/upload',
        'PUT /api/timetable/:id',
        'DELETE /api/timetable/:id',
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