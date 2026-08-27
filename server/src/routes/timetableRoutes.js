const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getTimetable,
  getTimetableByDepartment,
  getTimetableByFaculty,
  getTimetableByRoom,
  replaceTimetable,
  replaceTimetableFromFile,
  uploadTimetableFile,
  updateTimetableEntry,
  deleteTimetableEntry,
} = require('../controllers/timetableController');

// All timetable routes require authentication
router.use(protect);

// Public Timetable View Endpoints
router.get('/', getTimetable);
router.get('/department/:department', getTimetableByDepartment);
router.get('/faculty/:facultyName', getTimetableByFaculty);
router.get('/room/:roomId', getTimetableByRoom);

// Administrative Timetable Modification Endpoints (HOD Only)
router.post('/', authorize('HOD'), replaceTimetable);
router.post(
  '/upload',
  authorize('HOD'),
  uploadTimetableFile,
  replaceTimetableFromFile
);
router.put('/:id', authorize('HOD'), updateTimetableEntry);
router.delete('/:id', authorize('HOD'), deleteTimetableEntry);

module.exports = router;