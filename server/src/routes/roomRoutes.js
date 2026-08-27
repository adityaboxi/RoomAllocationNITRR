const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getRooms, getRoom, getAvailableRooms, getRoomsByFloor, getRoomsByBuilding,
  getRoomsByDepartment, createRoom, updateRoom, toggleRoomAvailability,
  deleteRoom, getRoomAvailability
} = require('../controllers/roomController');

router.get('/', protect, getRooms);
router.get('/available', protect, getAvailableRooms);
router.get('/floors', protect, getRoomsByFloor);
router.get('/buildings', protect, getRoomsByBuilding);
router.get('/department/:department', protect, getRoomsByDepartment);
router.get('/:id', protect, getRoom);
router.get('/:roomId/availability', protect, getRoomAvailability);
router.post('/', protect, authorize('HOD'), createRoom);
router.put('/:id', protect, authorize('HOD'), updateRoom);
router.put('/:id/toggle', protect, authorize('HOD'), toggleRoomAvailability);
router.delete('/:id', protect, authorize('HOD'), deleteRoom);

module.exports = router;