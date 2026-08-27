const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getBookings, getMyBookings, getBooking, getBookingsByRoom,
  getBookingsByFaculty, createBooking, cancelBooking, lockRoom, unlockRoom
} = require('../controllers/bookingController');

router.get('/', protect, getBookings);
router.get('/my', protect, getMyBookings);
router.get('/:id', protect, getBooking);
router.get('/room/:roomId', protect, getBookingsByRoom);
router.get('/faculty/:facultyEmail', protect, getBookingsByFaculty);
router.post('/', protect, createBooking);
router.put('/:id/cancel', protect, cancelBooking);
router.post('/lock', protect, lockRoom);
router.post('/unlock', protect, unlockRoom);

module.exports = router;