const mongoose = require('mongoose');

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000;
  }

  getConnectionOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 20,
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 5,
      maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME) || 30000,
      connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT) || 10000,
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000,
      heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT_FREQUENCY) || 10000,
      retryWrites: true,
      retryReads: true,
      writeConcern: {
        w: isProduction ? 'majority' : 1,
        j: isProduction ? true : false,
        wtimeout: 5000
      },
      readPreference: isProduction ? 'secondaryPreferred' : 'primary',
      autoIndex: !isProduction,
      autoCreate: true,
      family: 4,
      tls: process.env.DB_TLS === 'true',
      tlsAllowInvalidCertificates: !isProduction,
    };
  }

  getConnectionURI() {
    let uri = process.env.MONGODB_URI;
    if (!uri) {
      const host = process.env.DB_HOST || 'localhost';
      const port = process.env.DB_PORT || '27017';
      const name = process.env.DB_NAME || 'roomallocation';
      const user = process.env.DB_USER;
      const pass = process.env.DB_PASS;
      uri = user && pass ? `mongodb://${user}:${pass}@${host}:${port}/${name}` : `mongodb://${host}:${port}/${name}`;
    }
    if (process.env.DB_REPLICA_SET) {
      uri += `?replicaSet=${process.env.DB_REPLICA_SET}`;
    }
    return uri;
  }

  async connect() {
    try {
      const uri = this.getConnectionURI();
      const options = this.getConnectionOptions();
      console.log('🔄 Connecting to MongoDB...');
      this.connection = await mongoose.connect(uri, options);
      this.isConnected = true;
      this.retryCount = 0;
      this.setupEventListeners();
      this.logConnectionDetails();
      return this.connection;
    } catch (error) {
      console.error(`❌ MongoDB Connection Error: ${error.message}`);
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryDelay * Math.pow(1.5, this.retryCount - 1);
        console.log(`🔄 Retrying connection in ${delay/1000}s (Attempt ${this.retryCount}/${this.maxRetries})...`);
        await this.sleep(delay);
        return this.connect();
      }
      console.error('❌ All database connection attempts failed. Exiting...');
      process.exit(1);
    }
  }

  setupEventListeners() {
    mongoose.connection.on('connected', () => {
      this.isConnected = true;
      console.log('✅ MongoDB connection established');
    });
    mongoose.connection.on('error', (error) => {
      console.error(`❌ MongoDB connection error: ${error.message}`);
    });
    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
      console.warn('⚠️ MongoDB connection disconnected');
      if (process.env.NODE_ENV !== 'test') {
        setTimeout(() => this.connect(), 5000);
      }
    });
    mongoose.connection.on('reconnected', () => {
      this.isConnected = true;
      console.log('🔄 MongoDB reconnected successfully');
    });
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
    process.on('uncaughtException', (error) => {
      console.error(`💥 Uncaught Exception: ${error.message}`);
      this.close();
    });
  }

  logConnectionDetails() {
    const conn = mongoose.connection;
    console.log(`✅ MongoDB Connected: ${conn.host}`);
    console.log(`📦 Database: ${conn.name}`);
    console.log(`🔌 Connection Pool Size: ${conn.options?.maxPoolSize || 20}`);
    console.log(`📖 Read Preference: ${conn.options?.readPreference || 'primary'}`);
  }

  sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  async close() {
    if (!this.isConnected) return;
    try {
      console.log('🔄 Closing MongoDB connection...');
      await mongoose.connection.close();
      this.isConnected = false;
      console.log('✅ MongoDB connection closed successfully');
      process.exit(0);
    } catch (error) {
      console.error(`❌ Error closing MongoDB connection: ${error.message}`);
      process.exit(1);
    }
  }

  isReady() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  getHealthStatus() {
    const state = mongoose.connection.readyState;
    const states = { 0: 'Disconnected', 1: 'Connected', 2: 'Connecting', 3: 'Disconnecting', 99: 'Uninitialized' };
    return {
      connected: this.isReady(),
      state: states[state] || 'Unknown',
      host: mongoose.connection.host || 'unknown',
      database: mongoose.connection.name || 'unknown',
      poolSize: mongoose.connection.options?.maxPoolSize || 20,
      uptime: process.uptime()
    };
  }
}

const db = new DatabaseConnection();
const connectDB = () => db.connect();

module.exports = { connectDB, db, getConnection: () => mongoose.connection, isConnected: () => db.isReady(), getHealthStatus: () => db.getHealthStatus(), close: () => db.close() };
