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
  getBookingById,
  updateBooking,
  getBookingStats,
  getConflicts
} = require('../controllers/bookingController');

// ============================================
// PROFESSOR ROUTES (Regular Users)
// ============================================

// Book a room
router.post('/book', protect, bookRoom);

// Get my bookings
router.get('/my-bookings', protect, getMyBookings);

// Get booking by ID
router.get('/:id', protect, getBookingById);

// Cancel booking
router.put('/:id/cancel', protect, cancelBooking);

// Update booking (subject, comment only)
router.put('/:id', protect, updateBooking);

// ============================================
// ROOM LOCK SYSTEM
// ============================================

// Lock room (prevents double booking)
router.post('/lock', protect, lockRoom);

// Unlock room
router.post('/unlock', protect, unlockRoom);

// Get available time slots for a room
router.get('/time-slots', protect, getAvailableTimeSlots);

// ============================================
// HOD/ADMIN ROUTES
// ============================================

// Get all bookings (with filters)
router.get('/all', protect, authorize('hod'), getAllBookings);

// Get bookings for a specific room
router.get('/room/:roomId', protect, authorize('hod'), getRoomBookings);

// Get booking statistics
router.get('/stats/overview', protect, authorize('hod'), getBookingStats);

// Get conflicts
router.get('/conflicts', protect, authorize('hod'), getConflicts);

// ============================================
// ERROR HANDLING
// ============================================

// Catch-all for invalid booking routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Cannot ${req.method} ${req.originalUrl}`,
    error: 'Route not found'
  });
});

module.exports = router;
