const crypto = require('crypto');
const { logger } = require('./logger');

/**
 * Generate random OTP
 */
const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

/**
 * Get day of week from date
 */
const getDayOfWeek = (date) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = new Date(date);
  // Validate date
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date provided');
  }
  return days[d.getDay()];
};

/**
 * Check if two time slots overlap
 */
const isOverlapping = (start1, end1, start2, end2) => {
  // Validate inputs
  if (!start1 || !end1 || !start2 || !end2) {
    return false;
  }
  // Convert to minutes for easier comparison
  const toMinutes = (time) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  
  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);
  
  return s1 < e2 && s2 < e1;
};

/**
 * Generate unique lock ID
 */
const generateLockId = () => {
  return `lock_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
};

/**
 * Check if date is valid
 */
const isValidDate = (date) => {
  const d = new Date(date);
  return !isNaN(d.getTime());
};

/**
 * Check if date is in the past
 */
const isPastDate = (date) => {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

/**
 * Check if date is today or future
 */
const isTodayOrFuture = (date) => {
  return !isPastDate(date);
};

/**
 * Get current date with time set to midnight
 */
const getTodayDate = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/**
 * Format date for display
 */
const formatDate = (date, format = 'DD/MM/YYYY') => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  const formats = {
    'DD/MM/YYYY': `${day}/${month}/${year}`,
    'YYYY-MM-DD': `${year}-${month}-${day}`,
    'MMM DD, YYYY': `${d.toLocaleString('default', { month: 'short' })} ${day}, ${year}`
  };
  
  return formats[format] || formats['DD/MM/YYYY'];
};

/**
 * Format time for display
 */
const formatTime = (time) => {
  if (!time) return 'Invalid Time';
  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return 'Invalid Time';
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${ampm}`;
};

/**
 * Validate email domain
 */
const validateEmailDomain = (email, allowedDomains) => {
  if (!email) return false;
  if (!allowedDomains || !Array.isArray(allowedDomains)) return false;
  return allowedDomains.some(domain => email.endsWith(`@${domain}`));
};

/**
 * Mask email for display
 */
const maskEmail = (email) => {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const maskedLocal = local.length <= 3 ? local : local.slice(0, 2) + '***';
  return `${maskedLocal}@${domain}`;
};

/**
 * Get random color from array
 */
const getRandomColor = () => {
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Pagination helper
 */
const paginate = (data, page = 1, limit = 10) => {
  page = Math.max(1, parseInt(page));
  limit = Math.min(100, Math.max(1, parseInt(limit)));
  
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const paginatedData = data.slice(startIndex, endIndex);
  
  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      total: data.length,
      pages: Math.ceil(data.length / limit)
    }
  };
};

/**
 * Sleep helper
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Retry function with exponential backoff
 */
const retry = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const waitTime = delay * Math.pow(2, i);
        logger.warn(`Retry ${i + 1}/${maxRetries} failed, waiting ${waitTime}ms`);
        await sleep(waitTime);
      }
    }
  }
  throw lastError;
};

/**
 * Generate slug from text
 */
const generateSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Check if object is empty
 */
const isEmpty = (obj) => {
  return !obj || Object.keys(obj).length === 0;
};

/**
 * Deep clone object
 */
const deepClone = (obj) => {
  return JSON.parse(JSON.stringify(obj));
};

module.exports = {
  generateOTP,
  getDayOfWeek,
  isOverlapping,
  generateLockId,
  isValidDate,
  isPastDate,
  isTodayOrFuture,
  getTodayDate,
  formatDate,
  formatTime,
  validateEmailDomain,
  maskEmail,
  getRandomColor,
  paginate,
  sleep,
  retry,
  generateSlug,
  isEmpty,
  deepClone
};
