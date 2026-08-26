const crypto = require('crypto');

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

const getDayOfWeek = (date) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(date).getDay()];
};

const isOverlapping = (start1, end1, start2, end2) => {
  const toMinutes = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  return toMinutes(start1) < toMinutes(end2) && toMinutes(start2) < toMinutes(end1);
};

const generateLockId = () => `lock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

module.exports = { generateOTP, getDayOfWeek, isOverlapping, generateLockId };
