const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  bookRoom,
  getMyBookings,
  getAllBookings,
  cancelBooking,
  getRoomBookings,
  getAvailableTimeSlots,
  lockRoom,
  unlockRoom,
  getBookingById
} = require('../controllers/bookingController');

// Professor routes
router.post('/book', protect, bookRoom);
router.get('/my-bookings', protect, getMyBookings);
router.put('/:id/cancel', protect, cancelBooking);
router.get('/:id', protect, getBookingById);

// Room lock system
router.post('/lock', protect, lockRoom);
router.post('/unlock', protect, unlockRoom);
router.get('/time-slots', protect, getAvailableTimeSlots);

// HOD only routes
router.get('/all', protect, authorize('hod'), getAllBookings);
router.get('/room/:roomId', protect, getRoomBookings);

module.exports = router;
