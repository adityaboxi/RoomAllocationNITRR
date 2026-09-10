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
    // Admins don't book rooms — skip review queries entirely
    if (req.user.role === 'ADMIN') {
      return res.json({ success: true, data: [], total: 0 });
    }

    const todayStr = getTodayDateString();
    const currentHHMM = getCurrentTimeHHMM();

    // Limit lookback to 30 days: Prevents scanning the entire database and overloading
    // the $nin array if old data isn't deleted by the cron job.
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 30);
    const lookbackDateStr = `${lookbackDate.getFullYear()}-${String(lookbackDate.getMonth() + 1).padStart(2, '0')}-${String(lookbackDate.getDate()).padStart(2, '0')}`;

    const reviewedBookingIds = await Review.distinct('bookingId', {
      facultyId: req.user._id || req.user.id,
    });

    const candidateBookings = await Booking.find({
      facultyEmail: req.user.email,
      status: { $in: ['active', 'completed'] },
      _id: { $nin: reviewedBookingIds },
      date: { $lte: todayStr, $gte: lookbackDateStr },
    })
      .populate('roomId', 'name roomNumber floor building')
      .sort({ date: -1, endTime: -1 })
      .limit(20); // Only queue up to 20 popups at a time

    const pendingReviews = candidateBookings.filter((booking) => {
      if (booking.date < todayStr) return true;
      if (booking.date === todayStr && booking.endTime <= currentHHMM) return true;
      return false;
    });

    res.json({ success: true, data: pendingReviews, total: pendingReviews.length });
  } catch (error) {
    console.error("❌ [REVIEW]", 'Get pending reviews error:', error);
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
    console.error("❌ [REVIEW]", 'Submit review error:', error);
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
    const page = parseInt(req.query.page, 10) || 1;
    const limit = 20; // Load 20 reviews per page
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(roomId)) {
      return res.status(400).json({ success: false, message: 'Invalid room ID format' });
    }

    const roomIdObj = new mongoose.Types.ObjectId(roomId);

    // 1. Calculate Average Rating via DB Aggregation (O(1) memory instead of loading all docs)
    const stats = await Review.aggregate([
      { $match: { roomId: roomIdObj } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    const count = stats.length > 0 ? stats[0].count : 0;
    const avgRating = stats.length > 0 ? Number(stats[0].avgRating.toFixed(1)) : 0;

    // 2. Fetch paginated reviews
    const reviews = await Review.find({ roomId })
      .populate('facultyId', 'name email department')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      success: true,
      data: {
        reviews,
        avgRating,
        count,
        page,
        hasMore: count > page * limit
      },
    });
  } catch (error) {
    console.error("❌ [REVIEW]", 'Get room reviews error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- GET MY REVIEWS ----------
exports.getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ facultyId: req.user._id || req.user.id })
      .populate('roomId', 'name roomNumber building floor')
      .sort({ createdAt: -1 })
      .limit(100) // Safety Limit: prevent huge payloads
      .lean();

    res.json({
      success: true,
      data: reviews,
      total: reviews.length,
    });
  } catch (error) {
    console.error("❌ [REVIEW]", 'Get my reviews error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};