/**
 * Generates an RFC 5545 iCalendar (.ics) string for a classroom booking.
 * Used for email attachments and Google/Outlook Calendar sync.
 */
function generateIcsContent({
  bookingId,
  roomName,
  building,
  floor,
  date,
  startTime,
  endTime,
  purpose,
  facultyName,
  facultyEmail,
}) {
  const dateParts = (date || '').split('-').map(Number);
  const startParts = (startTime || '00:00').split(':').map(Number);
  const endParts = (endTime || '01:00').split(':').map(Number);

  const formatCalTime = (y, m, d, h, min) => {
    return `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}${String(min).padStart(2, '0')}00`;
  };

  const dtStart = formatCalTime(dateParts[0] || 2026, dateParts[1] || 1, dateParts[2] || 1, startParts[0] || 0, startParts[1] || 0);
  const dtEnd = formatCalTime(dateParts[0] || 2026, dateParts[1] || 1, dateParts[2] || 1, endParts[0] || 0, endParts[1] || 0);
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NIT Raipur//Room Allocation System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:booking-${bookingId || Date.now()}@nitrr.ac.in`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
    `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
    `SUMMARY:Classroom Reservation: ${roomName} (${purpose || 'Academic Session'})`,
    `DESCRIPTION:Academic Room Booking at NIT Raipur\\nRoom: ${roomName}\\nBuilding: ${building || 'Campus'}\\nFloor: ${floor || 'Main'}\\nBooked By: ${facultyName || 'Faculty'} (${facultyEmail || ''})\\nPurpose: ${purpose || 'Lecture/Session'}`,
    `LOCATION:${roomName}, ${building || ''}, NIT Raipur`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Classroom Reminder: 15 minutes before session',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

module.exports = { generateIcsContent };
