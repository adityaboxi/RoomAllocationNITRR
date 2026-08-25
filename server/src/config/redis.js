const Redis = require('ioredis');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
      
      console.log(`🔄 Connecting to Redis at: ${redisUrl}`);

      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => {
          if (times > 10) return null;
          return Math.min(times * 500, 3000);
        },
        maxRetriesPerRequest: 5,
        enableReadyCheck: true,
        connectTimeout: 10000,
        commandTimeout: 5000,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('✅ Redis connected');
      });

      this.client.on('error', (error) => {
        console.error(`❌ Redis error: ${error.message}`);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        console.warn('⚠️ Redis connection closed');
        this.isConnected = false;
      });

      await this.client.ping();
      console.log('✅ Redis ping successful');
      this.isConnected = true;
      return this.client;
    } catch (error) {
      console.error(`❌ Redis connection failed: ${error.message}`);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 300) {
    if (!this.isConnected || !this.client) return false;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      console.log(`✅ Redis set: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      console.error(`❌ Redis set error: ${error.message}`);
      return false;
    }
  }

  async get(key) {
    if (!this.isConnected || !this.client) return null;
    try {
      const data = await this.client.get(key);
      if (data) {
        console.log(`✅ Redis get: ${key} found`);
        return JSON.parse(data);
      }
      console.log(`❌ Redis get: ${key} not found`);
      return null;
    } catch (error) {
      console.error(`❌ Redis get error: ${error.message}`);
      return null;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) return false;
    try {
      await this.client.del(key);
      console.log(`✅ Redis del: ${key}`);
      return true;
    } catch (error) {
      console.error(`❌ Redis del error: ${error.message}`);
      return false;
    }
  }

  async setOTP(email, otp, purpose = 'signup') {
    const key = `otp:${purpose}:${email}`;
    const ttl = parseInt(process.env.REDIS_OTP_EXPIRY) || 300;
    const value = { otp, attempts: 0, verified: false, createdAt: Date.now() };
    console.log(`📝 Storing OTP in Redis: ${key} = ${otp}`);
    return this.set(key, value, ttl);
  }

  async getOTP(email, purpose = 'signup') {
    const key = `otp:${purpose}:${email}`;
    console.log(`🔍 Retrieving OTP from Redis: ${key}`);
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
      const ttl = await this.client.ttl(key);
      if (ttl > 0) {
        await this.client.set(key, JSON.stringify(data), 'EX', ttl);
        console.log(`📝 OTP attempts: ${data.attempts} for ${email}`);
        return data.attempts;
      }
    }
    return 0;
  }

  async getOTPAttempts(email, purpose = 'signup') {
    const data = await this.getOTP(email, purpose);
    return data ? data.attempts || 0 : 0;
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

const redisClient = new RedisClient();

module.exports = { redisClient };
