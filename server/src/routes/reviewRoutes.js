const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getRoomReviews,
  getPendingReviews,
  getMyReviews,
  submitReview,
  skipReview,
} = require('../controllers/reviewController');

// All review routes require authentication
router.use(protect);

// Review Query Endpoints
router.get('/pending', getPendingReviews);
router.get('/my', getMyReviews); // Resolves frontend api.js getMyReviews call
router.get('/room/:roomId', getRoomReviews);

// Review Submission and Skip Endpoints
router.post('/', submitReview);
router.post('/skip/:bookingId', skipReview);

module.exports = router;