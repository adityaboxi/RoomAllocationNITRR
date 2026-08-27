const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getTimetable,
  getTimetableByDepartment,
  getTimetableByFaculty,
  getTimetableByRoom,
  replaceTimetable,
  updateRoomDayTimetable,
  replaceTimetableFromFile,
  uploadTimetableFile,
  updateTimetableEntry,
  deleteTimetableEntry,
} = require('../controllers/timetableController');

// All timetable routes require authentication
router.use(protect);

// Query Endpoints
router.get('/', getTimetable);
router.get('/department/:department', getTimetableByDepartment);
router.get('/faculty/:facultyName', getTimetableByFaculty);
router.get('/room/:roomId', getTimetableByRoom);

// Modification Endpoints
router.post('/', replaceTimetable);
router.post('/room-day', updateRoomDayTimetable);
router.post(
  '/upload',
  uploadTimetableFile,
  replaceTimetableFromFile
);
router.put('/:id', updateTimetableEntry);
router.delete('/:id', deleteTimetableEntry);

module.exports = router;