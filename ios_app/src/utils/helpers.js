// ---------- TIMEZONE-SAFE DAY OF WEEK PARSER ----------
// Avoids UTC midnight day-shift bugs by constructing local Date components explicitly
export const getDayOfWeek = (dateString) => {
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

// ---------- FORMAT DATE STRING (e.g. 28 Aug 2026) ----------
export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return String(dateString);

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// ---------- GET NORMALIZED TODAY'S DATE (YYYY-MM-DD) ----------
export const getTodayDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ---------- GET CURRENT TIME (HH:mm) ----------
export const getCurrentTime = () => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

// ---------- TIME OVERLAP DETECTOR ----------
export const isTimeOverlapping = (start1, end1, start2, end2) => {
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