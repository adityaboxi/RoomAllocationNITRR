const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ---------- TIMEZONE-SAFE IST DATE STRING (YYYY-MM-DD) ----------
exports.getTodayDateString = () => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date()); // Outputs 'YYYY-MM-DD'
};

// ---------- TIMEZONE-SAFE IST TIME STRING (HH:mm) ----------
exports.getCurrentTimeHHMM = () => {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: process.env.TIMEZONE || 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(new Date()); // Outputs 'HH:mm'
};

// ---------- TIMEZONE-SAFE LOCAL DAY OF WEEK PARSER ----------
exports.getDayOfWeek = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return 'Monday';

  const parts = dateString.trim().split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const localDate = new Date(year, monthIndex, day);
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return days[localDate.getDay()];
  }

  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return days[new Date(dateString).getDay()] || 'Monday';
};

// ---------- TIME OVERLAP VALIDATOR ----------
exports.isOverlapping = (start1, end1, start2, end2) => {
  if (!start1 || !end1 || !start2 || !end2) return false;

  const toMinutes = (timeStr) => {
    const [h, m] = String(timeStr).trim().split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const s1 = toMinutes(start1);
  const e1 = toMinutes(end1);
  const s2 = toMinutes(start2);
  const e2 = toMinutes(end2);

  return s1 < e2 && s2 < e1;
};

// ---------- 6-DIGIT OTP GENERATOR ----------
exports.generateOTP = () => crypto.randomInt(100000, 999999).toString();

// ---------- CRYPTOGRAPHIC LOCK ID GENERATOR ----------
exports.generateLockId = () =>
  `lock_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

// ---------- JWT TOKEN GENERATOR (Wired to .env) ----------
exports.generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'nitrr_secret_key_default';
  const expiresIn = process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRE || '7d';
  return jwt.sign({ userId }, secret, { expiresIn });
};