const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getBookings,
  getMyBookings,
  getBooking,
  getBookingsByRoom,
  getBookingsByFaculty,
  createBooking,
  cancelBooking,
  lockRoom,
  unlockRoom,
} = require('../controllers/bookingController');

// All booking routes require authentication
router.use(protect);

// Booking Query Endpoints
router.get('/', getBookings);
router.get('/my', getMyBookings);
router.get('/:id', getBooking);
router.get('/room/:roomId', getBookingsByRoom);
router.get('/faculty/:facultyEmail', getBookingsByFaculty);

// Booking Modification Endpoints
router.post('/', createBooking);
router.put('/:id/cancel', cancelBooking);

// Temporary Room Lock Endpoints
router.post('/lock', lockRoom);
router.post('/unlock', unlockRoom);

module.exports = router;