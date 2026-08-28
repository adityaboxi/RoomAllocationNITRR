const mongoose = require('mongoose');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const { getIO } = require('../utils/socket');

const getTodayDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCurrentTimeHHMM = () => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const isBookingEnded = (booking) => {
  const todayStr = getTodayDateString();
  const currentHHMM = getCurrentTimeHHMM();

  if (booking.date < todayStr) return true;
  if (booking.date === todayStr && booking.endTime <= currentHHMM) return true;
  return false;
};

// ---------- GET PENDING REVIEWS ----------
exports.getPendingReviews = async (req, res) => {
  try {
    const todayStr = getTodayDateString();
    const currentHHMM = getCurrentTimeHHMM();

    const reviewedBookingIds = await Review.distinct('bookingId', {
      facultyId: req.user._id || req.user.id,
    });

    const candidateBookings = await Booking.find({
      facultyEmail: req.user.email,
      status: { $in: ['active', 'completed'] },
      _id: { $nin: reviewedBookingIds },
      date: { $lte: todayStr },
    })
      .populate('roomId', 'name roomNumber floor building')
      .sort({ date: -1, endTime: -1 });

    const pendingReviews = candidateBookings.filter((booking) => {
      if (booking.date < todayStr) return true;
      if (booking.date === todayStr && booking.endTime <= currentHHMM) return true;
      return false;
    });

    res.json({ success: true, data: pendingReviews, total: pendingReviews.length });
  } catch (error) {
    // console.error('Get pending reviews error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- SUBMIT REVIEW ----------
exports.submitReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    if (!bookingId || rating === undefined || rating === null) {
      return res.status(400).json({ success: false, message: 'Booking ID and rating are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID format' });
    }

    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be an integer between 1 and 5' });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.facultyEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: 'You can only review your own bookings' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot review a cancelled booking' });
    }

    if (!isBookingEnded(booking)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot review a class before it has concluded',
      });
    }

    const existing = await Review.findOne({ bookingId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'You have already submitted a review for this booking' });
    }

    const review = await Review.create({
      bookingId,
      roomId: booking.roomId,
      facultyId: req.user._id || req.user.id,
      facultyName: req.user.name,
      rating: numericRating,
      comment: (comment || '').trim() || 'No comment provided',
    });

    booking.status = 'completed';
    await booking.save();

    const io = getIO();
    if (io) {
      io.emit('review-created', {
        roomId: (booking.roomId?._id || booking.roomId).toString(),
        review,
      });
    }

    res.status(201).json({ success: true, message: 'Review submitted successfully', data: review });
  } catch (error) {
    // console.error('Submit review error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'A review for this booking already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET ROOM REVIEWS ----------
exports.getRoomReviews = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    const reviews = await Review.find({ roomId })
      .populate('facultyId', 'name email department')
      .sort({ createdAt: -1 })
      .lean();

    const totalRatings = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = reviews.length > 0 ? Number((totalRatings / reviews.length).toFixed(1)) : 0;

    res.json({
      success: true,
      data: {
        reviews,
        avgRating,
        count: reviews.length,
      },
    });
  } catch (error) {
    // console.error('Get room reviews error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET MY REVIEWS ----------
exports.getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ facultyId: req.user._id || req.user.id })
      .populate('roomId', 'name roomNumber building floor')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: reviews,
      total: reviews.length,
    });
  } catch (error) {
    // console.error('Get my reviews error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};