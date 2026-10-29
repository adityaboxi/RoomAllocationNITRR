const rateLimit = require('express-rate-limit');

// 1. Strict Limiter for Public Authentication & OTP Endpoints
// Prevents credential stuffing, OTP email flooding, and brute-force attacks
// Uses email-aware keying so institutional faculty sharing the campus WiFi NAT proxy don't throttle one another
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 2000, // Allows peak simultaneous campus signups
  standardHeaders: true, // Return standard RateLimit headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  skipSuccessfulRequests: false,
  keyGenerator: (req) => {
    // Key by email + IP so multiple faculty on the same campus gateway don't exhaust each other's quota
    const emailKey = req.body?.email ? String(req.body.email).trim().toLowerCase() : '';
    return emailKey ? `${emailKey}_${req.ip}` : req.ip;
  },
  skip: (req) => {
    // In development or test environments, bypass rate limiter so automated test suites run smoothly
    if (process.env.NODE_ENV !== 'production') return true;
    return req.path === '/api/health' || req.path === '/health';
  },
  validate: { keyGeneratorIpFallback: false },
  message: {
    success: false,
    message: 'Too many authentication attempts for this account. Please try again after 15 minutes.',
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
  validate: { keyGeneratorIpFallback: false },
  message: {
    success: false,
    message: 'Rate limit exceeded. Please slow down your requests.',
  },
  skip: (req) => {
    if (process.env.NODE_ENV !== 'production') return true;
    return req.path === '/api/health' || req.path === '/health';
  },
});

module.exports = {
  authRateLimiter,
  globalApiLimiter,
};
