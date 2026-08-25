const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createTimetable,
  getTimetable,
  getTimetableByDepartment,
  deleteTimetableEntry,
  getTimetableByRoom,
  getProfessorTimetable
} = require('../controllers/timetableController');

// Professor routes (view only)
router.get('/', protect, getTimetable);
router.get('/department/:department', protect, getTimetableByDepartment);
router.get('/room/:roomId', protect, getTimetableByRoom);
router.get('/professor', protect, getProfessorTimetable);

// HOD only routes
router.post('/', protect, authorize('hod'), createTimetable);
router.delete('/:id', protect, authorize('hod'), deleteTimetableEntry);

module.exports = router;
