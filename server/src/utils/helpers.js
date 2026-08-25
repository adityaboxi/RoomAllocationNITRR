const crypto = require('crypto');

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const getDayOfWeek = (date) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(date).getDay()];
};

const isOverlapping = (start1, end1, start2, end2) => {
  return start1 < end2 && start2 < end1;
};

const generateLockId = () => {
  return `lock_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
};

module.exports = {
  generateOTP,
  getDayOfWeek,
  isOverlapping,
  generateLockId
};
