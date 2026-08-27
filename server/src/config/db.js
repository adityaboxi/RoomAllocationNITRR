const mongoose = require('mongoose');

// ---------- DATABASE CONNECTION ----------
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/roomallocation';

  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 50, // Connection pooling to handle concurrent booking spikes
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

// Database connection lifecycle listeners
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB connection lost. Attempting reconnection...');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB runtime error:', err.message);
});

// Handle graceful process termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('🔌 MongoDB connection closed due to application termination');
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
});

module.exports = connectDB;