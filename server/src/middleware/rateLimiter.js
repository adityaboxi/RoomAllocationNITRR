const rateLimit = require('express-rate-limit');

// 1. Strict Limiter for Public Authentication & OTP Endpoints
// Prevents credential stuffing, OTP email flooding, and brute-force attacks
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // Max 25 attempts per 15 minutes per IP
  standardHeaders: true, // Return standard RateLimit headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skipSuccessfulRequests: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
    retryAfter: '15m',
  },
});

// 2. Global Rate Limiter for general API Endpoints
// Absorbs rapid bursts while protecting the database from denial-of-service
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Up to 1000 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Rate limit exceeded. Please slow down your requests.',
  },
  skip: (req) => {
    // Skip health checks from rate limiting
    return req.path === '/api/health' || req.path === '/health';
  },
});

module.exports = {
  authRateLimiter,
  globalApiLimiter,
};
