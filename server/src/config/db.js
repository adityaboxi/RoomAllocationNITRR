const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/roomallocation';
  const maxPoolSize = parseInt(process.env.DB_MAX_POOL_SIZE, 10) || 50;
  const minPoolSize = parseInt(process.env.DB_MIN_POOL_SIZE, 10) || 10;

  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize,
      minPoolSize,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    console.log(`🏊 Connection Pool: Min ${minPoolSize}, Max ${maxPoolSize}`);

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB Runtime Error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB Disconnected. Re-attempting connection...');
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection terminated through app termination (SIGINT)');
      process.exit(0);
    });

    return conn;
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;