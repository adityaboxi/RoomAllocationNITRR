
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// DATABASE CONNECTION
// ============================================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/roomallocation')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ MongoDB Error:', err.message));

// ============================================
// ROUTES
// ============================================

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🏫 Room Allocation System API - NIT Raipur',
    version: '1.0.0',
    status: 'Server is running! ✅',
    endpoints: {
      health: 'GET /health',
      test: 'GET /api/test',
      echo: 'POST /api/echo',
      users: 'GET /api/users/:id',
    },
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
  });
});

// Test GET route
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working! 🎉',
    query: req.query,
    timestamp: new Date().toISOString(),
  });
});

// Test POST route (echo)
app.post('/api/echo', (req, res) => {
  res.json({
    success: true,
    message: 'Data received!',
    receivedData: req.body,
    timestamp: new Date().toISOString(),
  });
});

// Test route with URL parameters
app.get('/api/users/:id', (req, res) => {
  res.json({
    success: true,
    message: 'User found',
    userId: req.params.id,
    query: req.query,
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: err.message,
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🚀 Room Allocation System Server');
  console.log('========================================');
  console.log(`📍 Server running on: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📦 MongoDB: ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
  console.log('========================================');
  console.log('📋 Available endpoints:');
  console.log(`  GET  /              - API Info`);
  console.log(`  GET  /health        - Health Check`);
  console.log(`  GET  /api/test      - Test GET`);
  console.log(`  POST /api/echo      - Test POST`);
  console.log(`  GET  /api/users/:id - Test URL params`);
  console.log('========================================\n');
});

module.exports = app;
