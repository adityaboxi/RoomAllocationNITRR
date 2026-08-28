require('dotenv').config();

const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { initSocket } = require('./utils/socket');
const { startCleanupScheduler, stopCleanupScheduler } = require('./utils/cleanup');

const PORT = parseInt(process.env.PORT, 10) || 3000;

let server = null;

// ---------- GLOBAL PROCESS ERROR HANDLERS ----------
process.on('uncaughtException', (err) => {
  // console.error('💥 UNCAUGHT EXCEPTION! Shutting down server...', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  // console.error('💥 UNHANDLED PROMISE REJECTION! Shutting down server...', err);
  process.exit(1);
});

// ---------- GRACEFUL SHUTDOWN HANDLER ----------
const handleGracefulShutdown = async (signal) => {
  // console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  stopCleanupScheduler();

  if (server) {
    server.close(() => {
      // console.log('🔌 HTTP server closed.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

// ---------- BOOTSTRAP APPLICATION ----------
async function startServer() {
  try {
    // 1. Connect to MongoDB Database
    await connectDB();

    // 2. Create HTTP Server Instance
    server = http.createServer(app);

    // 3. Attach Socket.IO to HTTP Server
    initSocket(server);

    // 4. Start Background Auto-Cleanup Cron Scheduler
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