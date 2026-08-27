const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getRooms,
  getRoom,
  getAvailableRooms,
  getRoomsByFloor,
  getRoomsByBuilding,
  getRoomsByDepartment,
  createRoom,
  updateRoom,
  toggleRoomAvailability,
  deleteRoom,
  getRoomAvailability,
} = require('../controllers/roomController');

// All room routes require authentication
router.use(protect);

// Publicly Readable Room Query Endpoints
router.get('/', getRooms);
router.get('/available', getAvailableRooms);
router.get('/floors', getRoomsByFloor);
router.get('/buildings', getRoomsByBuilding);
router.get('/department/:department', getRoomsByDepartment);
router.get('/:roomId/availability', getRoomAvailability);
router.get('/:id', getRoom);

// Administrative Room Modification Endpoints (HOD Only)
router.post('/', authorize('HOD'), createRoom);
router.put('/:id', authorize('HOD'), updateRoom);
router.put('/:id/toggle', authorize('HOD'), toggleRoomAvailability);
router.delete('/:id', authorize('HOD'), deleteRoom);

module.exports = router;