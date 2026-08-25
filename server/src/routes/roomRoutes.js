const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createRooms,
  getAllRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  getAvailableRooms,
  getRoomsByDepartment,
  toggleRoomAvailability
} = require('../controllers/roomController');

// Protected routes (all require authentication)
router.get('/', protect, getAllRooms);
router.get('/available', protect, getAvailableRooms);
router.get('/department/:department', protect, getRoomsByDepartment);
router.get('/:id', protect, getRoomById);

// HOD only routes
router.post('/bulk', protect, authorize('hod'), createRooms);
router.put('/:id', protect, authorize('hod'), updateRoom);
router.put('/:id/toggle', protect, authorize('hod'), toggleRoomAvailability);
router.delete('/:id', protect, authorize('hod'), deleteRoom);

module.exports = router;
