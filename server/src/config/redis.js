
const Redis = require('ioredis');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
  }

  async connect() {
    try {
      const options = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: (times) => {
          if (times > 5) {
            console.error('❌ Redis max retries reached');
            return null;
          }
          const delay = Math.min(times * 1000, 3000);
          console.log(`🔄 Redis retry ${times}/5 in ${delay}ms`);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        connectTimeout: 10000,
        commandTimeout: 5000,
        keepAlive: 30000,
      };

      console.log('🔄 Connecting to Redis Docker container...');
      this.client = new Redis(options);

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('✅ Redis connected to Docker container');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis is ready');
      });

      this.client.on('error', (error) => {
        console.error(`❌ Redis error: ${error.message}`);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.warn('⚠️ Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
      });

      // Test connection
      await this.client.ping();
      console.log('✅ Redis ping successful');
      return this.client;
    } catch (error) {
      console.error(`❌ Redis connection failed: ${error.message}`);
      console.warn('⚠️ Continuing without Redis - OTP will use fallback');
      return null;
    }
  }

  async set(key, value, ttlSeconds = 300) {
    if (!this.isConnected || !this.client) {
      console.warn('⚠️ Redis not available, using fallback');
      return false;
    }
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return true;
    } catch (error) {
      console.error(`❌ Redis set error: ${error.message}`);
      return false;
    }
  }

  async get(key) {
    if (!this.isConnected || !this.client) {
      console.warn('⚠️ Redis not available');
      return null;
    }
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`❌ Redis get error: ${error.message}`);
      return null;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) {
      console.warn('⚠️ Redis not available');
      return false;
    }
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error(`❌ Redis del error: ${error.message}`);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.client) {
      console.warn('⚠️ Redis not available');
      return false;
    }
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`❌ Redis exists error: ${error.message}`);
      return false;
    }
  }

  async setOTP(email, otp, purpose = 'signup') {
    const key = `otp:${purpose}:${email}`;
    const ttl = parseInt(process.env.REDIS_OTP_EXPIRY) || 300;
    const value = { otp, attempts: 0, createdAt: Date.now() };
    return this.set(key, value, ttl);
  }

  async getOTP(email, purpose = 'signup') {
    const key = `otp:${purpose}:${email}`;
    return this.get(key);
  }

  async deleteOTP(email, purpose = 'signup') {
    const key = `otp:${purpose}:${email}`;
    return this.del(key);
  }

  async incrementOTPAttempts(email, purpose = 'signup') {
    const key = `otp:${purpose}:${email}`;
    const data = await this.get(key);
    if (data) {
      data.attempts = (data.attempts || 0) + 1;
      const remainingTTL = await this.client.ttl(key);
      if (remainingTTL > 0) {
        await this.client.set(key, JSON.stringify(data), 'EX', remainingTTL);
        return data.attempts;
      }
    }
    return 0;
  }

  async getTTL(key) {
    if (!this.isConnected || !this.client) return -1;
    try {
      return await this.client.ttl(key);
    } catch {
      return -1;
    }
  }

  async flushAll() {
    if (!this.isConnected || !this.client) return false;
    try {
      await this.client.flushall();
      console.log('✅ Redis flushed');
      return true;
    } catch (error) {
      console.error(`❌ Redis flush error: ${error.message}`);
      return false;
    }
  }

  isReady() {
    return this.isConnected && this.client && this.client.status === 'ready';
  }

  async close() {
    if (this.client) {
      try {
        await this.client.quit();
        this.isConnected = false;
        console.log('✅ Redis connection closed');
      } catch (error) {
        console.error(`❌ Redis close error: ${error.message}`);
      }
    }
  }
}

// Singleton instance
const redisClient = new RedisClient();

module.exports = { redisClient };
