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

    // console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    // console.log(`🏊 Connection Pool: Min ${minPoolSize}, Max ${maxPoolSize}`);

    mongoose.connection.on('error', (err) => {
      // console.error('❌ MongoDB Runtime Error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      // console.warn('⚠️ MongoDB Disconnected.');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      // console.log('🔌 MongoDB connection closed through app termination (SIGINT)');
    });

    process.on('SIGTERM', async () => {
      await mongoose.connection.close();
      // console.log('🔌 MongoDB connection closed through app termination (SIGTERM)');
    });

    return conn;
  } catch (error) {
    // console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;