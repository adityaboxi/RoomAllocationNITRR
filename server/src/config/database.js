
const mongoose = require('mongoose');

/**
 * Database Configuration with:
 * - Connection pooling optimization
 * - Retry logic with exponential backoff
 * - Graceful shutdown handling
 * - Connection event monitoring
 */

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
    this.connection = null;
  }

  /**
   * Get connection options based on environment
   */
  getConnectionOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
      // Connection Pool
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 20,
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 5,
      maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME) || 30000,
      
      // Timeouts
      connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT) || 10000,
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
      serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 5000,
      heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT_FREQUENCY) || 10000,
      
      // Retry
      retryWrites: true,
      retryReads: true,
      
      // Write Concern
      writeConcern: {
        w: isProduction ? 'majority' : 1,
        j: isProduction ? true : false,
        wtimeout: 5000
      },
      
      // ⚠️ FIXED: Use primary for development (allows autoCreate/autoIndex)
      // Use secondaryPreferred for production reads
      readPreference: isProduction ? 'secondaryPreferred' : 'primary',
      
      // Other
      autoIndex: !isProduction, // Auto-index only in development
      autoCreate: true,
      family: 4, // Use IPv4
      
      // TLS/SSL (if needed)
      tls: process.env.DB_TLS === 'true',
      tlsAllowInvalidCertificates: !isProduction,
    };
  }

  /**
   * Connect to MongoDB with retry logic
   */
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
      
      // Retry connection with exponential backoff
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = this.retryDelay * Math.pow(1.5, this.retryCount - 1);
        console.log(`🔄 Retrying connection in ${delay/1000}s (Attempt ${this.retryCount}/${this.maxRetries})...`);
        
        await this.sleep(delay);
        return this.connect();
      }
      
      // If all retries fail, exit with error
      console.error('❌ All database connection attempts failed. Exiting...');
      process.exit(1);
    }
  }

  /**
   * Get connection URI from environment
   */
  getConnectionURI() {
    let uri = process.env.MONGODB_URI;
    
    if (!uri) {
      const host = process.env.DB_HOST || 'localhost';
      const port = process.env.DB_PORT || '27017';
      const name = process.env.DB_NAME || 'roomallocation';
      const user = process.env.DB_USER;
      const pass = process.env.DB_PASS;
      
      if (user && pass) {
        uri = `mongodb://${user}:${pass}@${host}:${port}/${name}`;
      } else {
        uri = `mongodb://${host}:${port}/${name}`;
      }
    }
    
    // Add replica set if configured
    if (process.env.DB_REPLICA_SET) {
      uri += `?replicaSet=${process.env.DB_REPLICA_SET}`;
    }
    
    return uri;
  }

  /**
   * Setup Mongoose event listeners
   */
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
      
      // Auto-reconnect if not manually disconnected
      if (process.env.NODE_ENV !== 'test') {
        setTimeout(() => this.connect(), 5000);
      }
    });

    mongoose.connection.on('reconnected', () => {
      this.isConnected = true;
      console.log('🔄 MongoDB reconnected successfully');
    });

    mongoose.connection.on('close', () => {
      this.isConnected = false;
      console.log('🔒 MongoDB connection closed');
    });

    // Handle SIGINT
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error(`💥 Uncaught Exception: ${error.message}`);
      this.close();
    });
  }

  /**
   * Log connection details
   */
  logConnectionDetails() {
    const conn = mongoose.connection;
    console.log(`✅ MongoDB Connected: ${conn.host}`);
    console.log(`📦 Database: ${conn.name}`);
    console.log(`🔌 Connection Pool Size: ${conn.options?.maxPoolSize || 20}`);
    console.log(`📖 Read Preference: ${conn.options?.readPreference || 'primary'}`);
    console.log(`🔄 Connection State: ${this.getConnectionState(conn.readyState)}`);
  }

  /**
   * Get human-readable connection state
   */
  getConnectionState(state) {
    const states = {
      0: 'Disconnected',
      1: 'Connected',
      2: 'Connecting',
      3: 'Disconnecting',
      99: 'Uninitialized'
    };
    return states[state] || 'Unknown';
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close database connection gracefully
   */
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

  /**
   * Check if database is connected
   */
  isReady() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Get health check status
   */
  getHealthStatus() {
    const state = mongoose.connection.readyState;
    return {
      connected: this.isReady(),
      state: this.getConnectionState(state),
      host: mongoose.connection.host || 'unknown',
      database: mongoose.connection.name || 'unknown',
      poolSize: mongoose.connection.options?.maxPoolSize || 20,
      uptime: process.uptime()
    };
  }
}

// Singleton instance
const db = new DatabaseConnection();

// Export the connect function directly
const connectDB = () => db.connect();

// Export utilities
module.exports = {
  connectDB,
  db,
  getConnection: () => mongoose.connection,
  isConnected: () => db.isReady(),
  getHealthStatus: () => db.getHealthStatus(),
  close: () => db.close()
};
