// Expand libuv worker threadpool for concurrent bcrypt password hashing under peak load
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '16';

require('dotenv').config();

const http = require('http');
const mongoose = require('mongoose');
const app = require('./app');
const connectDB = require('./config/db');
const { connectReportDB } = require('./config/reportDb');
const { initSocket } = require('./utils/socket');
const { startCleanupScheduler, stopCleanupScheduler } = require('./utils/cleanup');
const { startReportSyncScheduler, stopReportSyncScheduler } = require('./services/reportSyncService');

const PORT = parseInt(process.env.PORT, 10) || 3000;

let server = null;
let isShuttingDown = false;

// ---------- AUTO-BOOTSTRAP SUPER ADMIN ACCOUNT ----------
async function ensureAdminAccount() {
  try {
    const AdminUser = require('./models/AdminUser');
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@nitrr.ac.in').trim().toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'adminsecret123';

    const existingAdmin = await AdminUser.findOne({ email: adminEmail });
    if (!existingAdmin) {
      await AdminUser.create({
        name: 'System Administrator',
        email: adminEmail,
        password: adminPassword,
        role: 'ADMIN',
        department: 'ALL',
        isFirstLogin: false,
      });
      console.log(`👤 [BOOTSTRAP] Default Super Admin account initialized (${adminEmail})`);
    }
  } catch (err) {
    console.warn('⚠️  [BOOTSTRAP] Note: Super Admin verification skipped:', err.message);
  }
}

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
  stopReportSyncScheduler();

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
    // 1. Connect to MongoDB (Primary Operational DB & Dedicated Report DB)
    await connectDB();
    await connectReportDB();

    // 2. Ensure Super Admin Account Exists
    await ensureAdminAccount();

    // 3. Create HTTP Server
    server = http.createServer(app);

    // 4. Attach Socket.IO
    initSocket(server);

    // 5. Start Background Report Database Sync Scheduler (30-day Cycle)
    startReportSyncScheduler();

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
      console.log(`🧹 Cleanup    : Disabled (Historical Data Retained)`);
      console.log(`🛡️  Security   : Helmet Headers & Rate Limit Active`);
      console.log(`======================================================\n`);
    });
  } catch (err) {
    console.error('❌ [SERVER] Failed to initialize server:', err.message);
    process.exit(1);
  }
}

startServer();