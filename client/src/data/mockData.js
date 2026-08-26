export const initialRooms = [
  { id: 'r1', name: 'CS-101 (Lecture Hall)', capacity: 70, type: 'Classroom', floor: '1st Floor' },
  { id: 'r2', name: 'CS-102 (Smart Classroom)', capacity: 60, type: 'Classroom', floor: '1st Floor' },
  { id: 'r3', name: 'CS-Lab A (Network Lab)', capacity: 35, type: 'Lab', floor: 'Ground Floor' },
  { id: 'r4', name: 'Seminar Hall (Main)', capacity: 120, type: 'Auditorium', floor: '2nd Floor' },
];

export const initialTimetable = [
  { id: 'tt-1', roomId: 'r1', day: 'Wednesday', startTime: '09:00', endTime: '10:00', subject: 'Data Structures', classGroup: 'CS-3A', faculty: 'Dr. D. S. Sisodia' },
  { id: 'tt-2', roomId: 'r1', day: 'Wednesday', startTime: '10:00', endTime: '11:00', subject: 'Operating Systems', classGroup: 'CS-5B', faculty: 'Prof. R. Verma' },
  { id: 'tt-3', roomId: 'r2', day: 'Wednesday', startTime: '11:15', endTime: '12:15', subject: 'Database Systems', classGroup: 'CS-4A', faculty: 'Dr. P. Sharma' },
];

export const initialBookings = [
  { id: 'bk-1', roomId: 'r3', date: new Date().toISOString().split('T')[0], startTime: '14:00', endTime: '15:00', facultyName: 'Prof. Rajesh Verma', facultyEmail: 'rverma.cs@nitrr.ac.in', purpose: 'Remedial Doubt Session' },
];