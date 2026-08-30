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

// Enable Trust Proxy for Render / Cloudflare deployments
app.set('trust proxy', 1);

// ---------- GLOBAL CORS CONFIGURATION (iOS WKWebView & Web Support) ----------
const rawOrigins = process.env.CORS_ORIGIN || process.env.CLIENT_URL || '';
const allowedOrigins = rawOrigins
  ? rawOrigins.split(',').map((url) => url.trim()).filter(Boolean)
  : [];

const corsOptions = {
  origin: (origin, callback) => {
    // 1. Allow mobile requests with no origin (native iOS/Android HTTP) or capacitor/ionic
    if (
      !origin ||
      origin.startsWith('capacitor://') ||
      origin.startsWith('ionic://') ||
      origin.includes('localhost')
    ) {
      return callback(null, true);
    }

    // 2. Check allowed origins list from environment variables
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // 3. Fallback allow for mobile webview
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Explicitly handle preflight OPTIONS for iOS

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