const Review = require('../models/Review');
const Booking = require('../models/Booking');

// Helper to check if booking is ended (endTime < current time and date is today or past)
const isBookingEnded = (booking) => {
  const now = new Date();
  const bookingDate = new Date(booking.date);
  const [h, m] = booking.endTime.split(':').map(Number);
  bookingDate.setHours(h, m, 0, 0);
  return bookingDate < now && booking.status === 'active';
};

// Get pending reviews for the logged-in user
exports.getPendingReviews = async (req, res) => {
  try {
    const user = req.user;
    // Find all active bookings for this user that have ended and are not reviewed
    const bookings = await Booking.find({
      facultyEmail: user.email,
      status: 'active'
    }).populate('roomId', 'name roomNumber');

    const pending = [];
    for (const booking of bookings) {
      if (isBookingEnded(booking)) {
        // Check if review already exists
        const existingReview = await Review.findOne({ bookingId: booking._id });
        if (!existingReview) {
          pending.push(booking);
        }
      }
    }
    res.json({ success: true, data: pending });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Submit a review
exports.submitReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    if (!bookingId || !rating) {
      return res.status(400).json({ success: false, message: 'Booking ID and rating are required' });
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.facultyEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: 'Not authorized to review this booking' });
    }
    // Check if already reviewed
    const existingReview = await Review.findOne({ bookingId });
    if (existingReview) {
      return res.status(400).json({ success: false, message: 'This booking has already been reviewed' });
    }
    const review = await Review.create({
      bookingId,
      roomId: booking.roomId,
      facultyEmail: req.user.email,
      rating,
      comment: comment || '',
    });
    res.status(201).json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get reviews for a room (public)
exports.getRoomReviews = async (req, res) => {
  try {
    const { roomId } = req.params;
    const reviews = await Review.find({ roomId }).sort({ createdAt: -1 });
    // Calculate average rating
    let avgRating = 0;
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      avgRating = sum / reviews.length;
    }
    res.json({ success: true, data: { reviews, avgRating, count: reviews.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};