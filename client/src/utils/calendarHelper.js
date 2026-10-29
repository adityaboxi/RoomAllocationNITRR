/**
 * Calendar Integration Utilities
 * Supports 1-click Google Calendar sync and standard .ics export for Outlook & Apple Calendar.
 */

// Helper to format ISO/date string to Google Calendar format (YYYYMMDDTHHmmSS)
function formatGoogleCalDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);

  const pad = (n) => String(n).padStart(2, '0');
  return `${year}${pad(month)}${pad(day)}T${pad(hours)}${pad(minutes)}00`;
}

/**
 * Builds a direct 1-click Google Calendar Web URL
 */
export function getGoogleCalendarUrl(booking) {
  if (!booking) return '#';

  const roomName = booking.roomId?.name || booking.roomName || 'Classroom';
  const building = booking.roomId?.building || booking.building || 'Main Campus';
  const floor = booking.roomId?.floor || booking.floor || '';
  const dateStr = booking.date || '';
  const startTime = booking.startTime || '09:00';
  const endTime = booking.endTime || '10:00';

  const startDt = formatGoogleCalDateTime(dateStr, startTime);
  const endDt = formatGoogleCalDateTime(dateStr, endTime);

  const title = encodeURIComponent(`Classroom Session: ${roomName} (${booking.purpose || 'Lecture'})`);
  const details = encodeURIComponent(
    `Academic Reservation at NIT Raipur\nRoom: ${roomName}\nLocation: ${building}${floor ? `, ${floor}` : ''}\nPurpose: ${booking.purpose || 'Class session'}\nBooked By: ${booking.facultyName || 'Faculty'}`
  );
  const location = encodeURIComponent(`${roomName}, ${building}, NIT Raipur`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDt}/${endDt}&details=${details}&location=${location}`;
}

/**
 * Generates and downloads a standard RFC 5545 .ics file for Outlook, Apple Calendar, and mobile
 */
export function downloadIcsFile(booking) {
  if (!booking) return;

  const roomName = booking.roomId?.name || booking.roomName || 'Classroom';
  const building = booking.roomId?.building || booking.building || 'Campus';
  const floor = booking.roomId?.floor || booking.floor || '';
  const dateParts = (booking.date || '').split('-').map(Number);
  const startParts = (booking.startTime || '09:00').split(':').map(Number);
  const endParts = (booking.endTime || '10:00').split(':').map(Number);

  const pad = (n) => String(n).padStart(2, '0');
  const formatCalTime = (y, m, d, h, min) => `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}00`;

  const dtStart = formatCalTime(dateParts[0] || 2026, dateParts[1] || 1, dateParts[2] || 1, startParts[0] || 0, startParts[1] || 0);
  const dtEnd = formatCalTime(dateParts[0] || 2026, dateParts[1] || 1, dateParts[2] || 1, endParts[0] || 0, endParts[1] || 0);
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NIT Raipur//Room Allocation System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:booking-${booking.id || booking._id || Date.now()}@nitrr.ac.in`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
    `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
    `SUMMARY:Classroom Reservation: ${roomName} (${booking.purpose || 'Academic Session'})`,
    `DESCRIPTION:Academic Reservation at NIT Raipur\\nRoom: ${roomName}\\nBuilding: ${building}${floor ? `, ${floor}` : ''}\\nPurpose: ${booking.purpose || 'Session'}`,
    `LOCATION:${roomName}, ${building}, NIT Raipur`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Classroom Reminder: 15 minutes before session',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsLines], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nitrr-class-${roomName.replace(/\s+/g, '_')}-${booking.date || 'event'}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
