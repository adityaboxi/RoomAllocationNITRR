const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
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

// Query Endpoints
router.get('/', getRooms);
router.get('/available', getAvailableRooms);
router.get('/floors', getRoomsByFloor);
router.get('/buildings', getRoomsByBuilding);
router.get('/department/:department', getRoomsByDepartment);
router.get('/:roomId/availability', getRoomAvailability);
router.get('/:id', getRoom);

// Modification Endpoints (Creator or HOD verified in controller)
router.post('/', createRoom);
router.put('/:id', updateRoom);
router.put('/:id/toggle', toggleRoomAvailability);
router.delete('/:id', deleteRoom);

module.exports = router;