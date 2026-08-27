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
  deleteTimetableEntry
} = require('../controllers/timetableController');

router.get('/', protect, getTimetable);
router.get('/department/:department', protect, getTimetableByDepartment);
router.get('/faculty/:facultyName', protect, getTimetableByFaculty);
router.get('/room/:roomId', protect, getTimetableByRoom);
router.post('/', protect, authorize('HOD'), replaceTimetable);
router.post(
  '/upload',
  protect,
  authorize('HOD'),
  uploadTimetableFile,
  replaceTimetableFromFile
);
router.put('/:id', protect, authorize('HOD'), updateTimetableEntry);
router.delete('/:id', protect, authorize('HOD'), deleteTimetableEntry);

module.exports = router;