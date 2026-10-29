const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getRooms,
  getRoom,
  getAvailableRooms,
  getAllRoomsStatus,
  getRoomsByFloor,
  getRoomsByBuilding,
  getRoomsByDepartment,
  createRoom,
  updateRoom,
  toggleRoomAvailability,
  deleteRoom,
  getRoomAvailability,
  getInstantAvailableRooms,
  reportRoomIssue,
  resolveRoomIssue,
} = require('../controllers/roomController');

// All room routes require authentication
router.use(protect);

// Query Endpoints
router.get('/', getRooms);
router.get('/instant-available', getInstantAvailableRooms);
router.get('/available', getAvailableRooms);
router.get('/status', getAllRoomsStatus);
router.get('/floors', getRoomsByFloor);
router.get('/buildings', getRoomsByBuilding);
router.get('/department/:department', getRoomsByDepartment);
router.get('/:roomId/availability', getRoomAvailability);
router.get('/:id', getRoom);

// Modification & Issue Endpoints
router.post('/', createRoom);
router.post('/:id/report-issue', reportRoomIssue);
router.put('/:id/resolve-issue/:issueId', resolveRoomIssue);
router.put('/:id/toggle', toggleRoomAvailability);
router.put('/:id', updateRoom);
router.delete('/:id', deleteRoom);

module.exports = router;