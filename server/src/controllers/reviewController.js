const Review = require('../models/Review');
const Booking = require('../models/Booking');

const isBookingEnded = (booking) => {
  const now = new Date();
  const bookingDate = new Date(booking.date);
  const [h, m] = booking.endTime.split(':').map(Number);
  bookingDate.setHours(h, m, 0, 0);
  return bookingDate < now && booking.status === 'active';
};

exports.getPendingReviews = async (req, res) => {
  try {
    const bookings = await Booking.find({
      facultyEmail: req.user.email,
      status: 'active'
    }).populate('roomId', 'name roomNumber');

    const pending = [];
    for (const booking of bookings) {
      if (isBookingEnded(booking)) {
        const existing = await Review.findOne({ bookingId: booking._id });
        if (!existing) pending.push(booking);
      }
    }
    res.json({ success: true, data: pending });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    if (!bookingId || !rating) {
      return res.status(400).json({ success: false, message: 'Booking ID and rating are required' });
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.facultyEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }
    const existing = await Review.findOne({ bookingId });
    if (existing) return res.status(400).json({ success: false, message: 'Already reviewed' });

    const review = await Review.create({
      bookingId,
      roomId: booking.roomId,
      facultyId: req.user._id,
      facultyName: req.user.name,
      rating,
      comment: comment || '',
    });
    res.status(201).json({ success: true, data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRoomReviews = async (req, res) => {
  try {
    const { roomId } = req.params;
    const reviews = await Review.find({ roomId })
      .populate('facultyId', 'name email')
      .sort({ createdAt: -1 });
    const avgRating = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
    res.json({ success: true, data: { reviews, avgRating, count: reviews.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};