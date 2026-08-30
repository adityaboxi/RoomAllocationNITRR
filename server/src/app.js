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
  process.env.CLIENT_URL 
)
  .split(',')
  .map((url) => url.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with valid origins, server-to-server, or mobile WebView
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