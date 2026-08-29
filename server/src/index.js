require('dotenv').config();

const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./utils/socket');
const { startCleanupScheduler, stopCleanupScheduler } = require('./utils/cleanup');

const PORT = parseInt(process.env.PORT, 10) || 3000;

let server = null;
let isShuttingDown = false;

// ---------- GLOBAL PROCESS ERROR HANDLERS ----------
process.on('uncaughtException', (err) => {
  // console.error('💥 UNCAUGHT EXCEPTION! Shutting down server...', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  // console.error('💥 UNHANDLED PROMISE REJECTION! Shutting down server...', err);
  process.exit(1);
});

// ---------- IDEMPOTENT GRACEFUL SHUTDOWN HANDLER ----------
const handleGracefulShutdown = async (signal) => {
  // If user presses Ctrl+C again while already shutting down, exit immediately
  if (isShuttingDown) {
    process.exit(0);
    return;
  }

  isShuttingDown = true;
  // console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

  // Stop background cron jobs
  stopCleanupScheduler();

  // Safety fallback: force exit after 2.5 seconds if connections hang
  const forceExitTimer = setTimeout(() => {
    process.exit(0);
  }, 2500);
  forceExitTimer.unref();

  try {
    // 1. Close MongoDB Connection Pool
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      // console.log('🔌 MongoDB connection closed.');
    }

    // 2. Close HTTP Server & Socket.IO
    if (server && server.listening) {
      server.close(() => {
        // console.log('🔌 HTTP server closed.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  } catch (err) {
    process.exit(0);
  }
};

// Register single process listeners
process.once('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.once('SIGINT', () => handleGracefulShutdown('SIGINT'));

// ---------- BOOTSTRAP APPLICATION ----------
async function startServer() {
  try {
    // 1. Connect to MongoDB Database
    await connectDB();

    // 2. Create HTTP Server Instance
    server = http.createServer(app);

    // 3. Attach Socket.IO to HTTP Server
    initSocket(server);

    // 4. Start Background Auto-Cleanup Scheduler
    startCleanupScheduler();

    // 5. Start Listening on Configured Port
    server.listen(PORT, () => {
      // console.log(`\n======================================================`);
      // console.log(`🚀 NIT Raipur Room Allocation API Server Running`);
      // console.log(`📡 URL: http://localhost:${PORT}`);
      // console.log(`🔌 Socket.IO: Initialized and attached`);
      // console.log(`🔐 Authentication: JWT (${process.env.JWT_EXPIRES_IN || '7d'})`);
      // console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      // console.log(`======================================================\n`);
    });
  } catch (err) {
    // console.error('❌ Failed to initialize server:', err.message);
    process.exit(1);
  }
}

startServer();