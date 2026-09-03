const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/roomallocation';
  const maxPoolSize = parseInt(process.env.DB_MAX_POOL_SIZE, 10) || 50;
  const minPoolSize = parseInt(process.env.DB_MIN_POOL_SIZE, 10) || 10;
  const serverSelectionTimeoutMS = parseInt(process.env.DB_TIMEOUT_MS, 10) || 5000;

  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize,
      minPoolSize,
      serverSelectionTimeoutMS,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ [DB] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    console.log(`🏊 [DB] Connection Pool: Min ${minPoolSize}, Max ${maxPoolSize}`);

    mongoose.connection.on('error', (err) => {
      console.error('❌ [DB] MongoDB Runtime Error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  [DB] MongoDB Disconnected.');
    });

    return conn;
  } catch (error) {
    console.error('❌ [DB] MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;