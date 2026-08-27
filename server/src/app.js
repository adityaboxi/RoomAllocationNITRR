const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const timetableRoutes = require('./routes/timetableRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const notificationRoutes = require('./routes/notificationRoutes'); // <-- added
const { errorHandler } = require('./middleware/errorHandler');
const statsRoutes = require('./routes/statsRoutes');

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/notifications', notificationRoutes); // <-- added
app.use('/api/stats', statsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏫 Room Allocation System API',
    version: '2.0.0',
    endpoints: {
      auth: [
        'POST /api/auth/login',
        'POST /api/auth/signup',
        'POST /api/auth/forgot-password',
        'POST /api/auth/verify-reset-otp',
        'POST /api/auth/reset-password',
        'POST /api/auth/change-password',
        'GET /api/auth/me'
      ],
      rooms: [
        'GET /api/rooms (with filters)',
        'GET /api/rooms/:id',
        'GET /api/rooms/available (with filters)',
        'GET /api/rooms/floors',
        'GET /api/rooms/buildings',
        'GET /api/rooms/department/:department',
        'POST /api/rooms (HOD only)',
        'PUT /api/rooms/:id (HOD only)',
        'PUT /api/rooms/:id/toggle (HOD only)',
        'DELETE /api/rooms/:id (HOD only)',
        'GET /api/rooms/:roomId/availability'
      ],
      timetable: [
        'GET /api/timetable',
        'GET /api/timetable/department/:dept',
        'GET /api/timetable/faculty/:name',
        'GET /api/timetable/room/:roomId',
        'POST /api/timetable (HOD only) — REPLACES entire timetable',
        'PUT /api/timetable/:id (HOD only)',
        'DELETE /api/timetable/:id (HOD only)'
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
        'POST /api/bookings/unlock'
      ],
      notifications: [
        'GET /api/notifications',
        'PUT /api/notifications/:id/read',
        'PUT /api/notifications/read-all',
        'DELETE /api/notifications/:id',
        'DELETE /api/notifications'
      ],
      reviews: [
        'GET /api/reviews/pending',
        'POST /api/reviews',
        'GET /api/reviews/room/:roomId'
      ]
    }
  });
});

// Error handler
app.use(errorHandler);

module.exports = app;