const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoose = require('mongoose');

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
const { authRateLimiter, globalApiLimiter } = require('./middleware/rateLimiter');

const app = express();

// Enable Trust Proxy for Render / Cloudflare / Nginx deployments
app.set('trust proxy', 1);

// 1. Enterprise Security Headers via Helmet
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false, // Disabled for standalone API backend
  })
);

// 2. HTTP Response Compression (Gzip / Deflate)
app.use(compression());

// ---------- GLOBAL CORS CONFIGURATION (iOS WKWebView & Web Support) ----------
const rawOrigins = process.env.CORS_ORIGIN || process.env.CLIENT_URL;
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
      (process.env.NODE_ENV !== 'production' && origin.includes('localhost'))
    ) {
      return callback(null, true);
    }

    // 2. Check allowed origins list from environment variables
    if (
      allowedOrigins.includes(origin) ||
      (process.env.NODE_ENV !== 'production' && allowedOrigins.includes('*'))
    ) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV === 'production') {
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    }

    // 3. Fallback allow for development
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Authorization', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Explicitly handle preflight OPTIONS for iOS

// Body Parsing Middlewares
const bodyLimit = process.env.BODY_LIMIT || '10mb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// ---------- SYSTEM HEALTH & PROBE MONITORING ----------
app.get(['/health', '/api/health'], (req, res) => {
  const dbState = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  const isHealthy = dbState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'UP' : 'DOWN',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: states[dbState] || 'unknown',
      host: mongoose.connection.host || 'local',
      name: mongoose.connection.name || 'roomallocation',
    },
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

// ---------- GLOBAL & AUTH RATE LIMITING ----------
app.use('/api', globalApiLimiter);
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/send-signup-otp', authRateLimiter);
app.use('/api/auth/verify-signup-otp', authRateLimiter);
app.use('/api/auth/send-login-otp', authRateLimiter);
app.use('/api/auth/verify-login-otp', authRateLimiter);
app.use('/api/auth/forgot-password', authRateLimiter);

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