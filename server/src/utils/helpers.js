const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// ---------- GENERATE 6-DIGIT SECURE OTP ----------
exports.generateOTP = () => crypto.randomInt(100000, 999999).toString();

// ---------- TIMEZONE-SAFE DAY OF WEEK PARSER ----------
// Avoids UTC midnight timezone skew by constructing local Date components explicitly
exports.getDayOfWeek = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return 'Monday';

  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const localDate = new Date(year, monthIndex, day);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[localDate.getDay()];
  }

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(dateStr).getDay()] || 'Monday';
};

// ---------- SAFE TIME OVERLAP DETECTOR ----------
// Returns true if [start1, end1) intersects with [start2, end2)
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

// ---------- GENERATE CRYPTOGRAPHIC LOCK ID ----------
exports.generateLockId = () =>
  `lock_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

// ---------- GENERATE JWT AUTH TOKEN ----------
exports.generateToken = (userId) =>
  jwt.sign(
    { userId: userId.toString() },
    process.env.JWT_SECRET || 'default_jwt_secret',
    { expiresIn: '7d' }
  );