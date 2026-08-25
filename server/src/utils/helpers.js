const crypto = require('crypto');

const generateOTP = () => crypto.randomInt(100000, 999999).toString();

const getDayOfWeek = (date) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = new Date(date);
  if (isNaN(d.getTime())) throw new Error('Invalid date');
  return days[d.getDay()];
};

const isOverlapping = (start1, end1, start2, end2) => {
  const toMinutes = (time) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  return toMinutes(start1) < toMinutes(end2) && toMinutes(start2) < toMinutes(end1);
};

const generateLockId = () => `lock_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

const isValidDate = (date) => !isNaN(new Date(date).getTime());

const isPastDate = (date) => {
  const d = new Date(date);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d < today;
};

const formatDate = (date, format = 'DD/MM/YYYY') => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid Date';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const formats = { 'DD/MM/YYYY': `${day}/${month}/${year}`, 'YYYY-MM-DD': `${year}-${month}-${day}`, 'MMM DD, YYYY': `${d.toLocaleString('default', { month: 'short' })} ${day}, ${year}` };
  return formats[format] || formats['DD/MM/YYYY'];
};

const formatTime = (time) => {
  if (!time) return 'Invalid Time';
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 'Invalid Time';
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const validateEmailDomain = (email, allowedDomains) => {
  if (!email || !allowedDomains || !Array.isArray(allowedDomains)) return false;
  return allowedDomains.some(domain => email.endsWith(`@${domain}`));
};

const maskEmail = (email) => {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
};

module.exports = { generateOTP, getDayOfWeek, isOverlapping, generateLockId, isValidDate, isPastDate, formatDate, formatTime, validateEmailDomain, maskEmail };
