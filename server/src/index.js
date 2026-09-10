require('dotenv').config();

const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./utils/socket');
const { startCleanupScheduler, stopCleanupScheduler } = require('./utils/cleanup');

const PORT = parseInt(process.env.PORT, 10);

let server = null;
let isShuttingDown = false;

// ---------- GLOBAL PROCESS ERROR HANDLERS ----------
process.on('uncaughtException', (err) => {
  console.error('💥 [FATAL] UNCAUGHT EXCEPTION! Shutting down server...', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('💥 [FATAL] UNHANDLED PROMISE REJECTION! Shutting down server...', err);
  process.exit(1);
});

// ---------- IDEMPOTENT GRACEFUL SHUTDOWN HANDLER ----------
const handleGracefulShutdown = async (signal) => {
  if (isShuttingDown) {
    process.exit(0);
    return;
  }

  isShuttingDown = true;
  console.log(`\n🛑 [SERVER] Received ${signal}. Starting graceful shutdown...`);

  const forceExitTimer = setTimeout(() => {
    console.warn('[SERVER] Force exit after 2.5s timeout');
    process.exit(0);
  }, 2500);
  forceExitTimer.unref();

  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('🔌 [SERVER] MongoDB connection closed.');
    }

    if (server && server.listening) {
      server.close(() => {
        console.log('🔌 [SERVER] HTTP server closed.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('[SERVER] Error during shutdown:', err.message);
    process.exit(0);
  }
};

process.once('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.once('SIGINT', () => handleGracefulShutdown('SIGINT'));

// ---------- BOOTSTRAP APPLICATION ----------
async function startServer() {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Create HTTP Server
    server = http.createServer(app);

    // 3. Attach Socket.IO
    initSocket(server);

    // 4. Start Background Cleanup Scheduler (Disabled per user request)
    // startCleanupScheduler();

    // Production Security Verification
    if (process.env.NODE_ENV === 'production') {
      const secret = process.env.JWT_SECRET || '';
      if (secret.includes('example') || secret.length < 32) {
        console.warn('⚠️  [SECURITY WARNING] Weak or default JWT_SECRET detected in production! Please generate a unique >= 32-char key.');
      }
    }

    // 5. Listen
    server.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 NIT Raipur Room Allocation API Server Running`);
      console.log(`📡 URL        : http://localhost:${PORT}`);
      console.log(`🔌 Socket.IO  : Initialized`);
      console.log(`🔐 JWT Expiry : ${process.env.JWT_EXPIRES_IN}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
      const cleanupText = process.env.CLEANUP_CRON_INTERVAL_HOURS
        ? `${Math.round(parseInt(process.env.CLEANUP_CRON_INTERVAL_HOURS, 10) / 24)} days (${process.env.CLEANUP_CRON_INTERVAL_HOURS}h)`
        : '20 days';
      console.log(`🧹 Cleanup    : Every ${cleanupText}`);
      console.log(`🛡️  Security   : Helmet Headers & Rate Limit Active`);
      console.log(`======================================================\n`);
    });
  } catch (err) {
    console.error('❌ [SERVER] Failed to initialize server:', err.message);
    process.exit(1);
  }
}

startServer();