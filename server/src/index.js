const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true }));

// ============================================
// ROUTES
// ============================================

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏫 Room Allocation System API - NIT Raipur',
    version: '1.0.0',
    status: 'Server is running! ✅',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: 'GET /health',
      test: 'GET /api/test',
      echo: 'POST /api/echo',
    },
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    server: 'Running on port ' + PORT,
    memory: process.memoryUsage(),
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

// 404 handler - Route not found
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
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

module.exports = app;
