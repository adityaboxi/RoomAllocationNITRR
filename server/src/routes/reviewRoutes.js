const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getPendingReviews,
  submitReview,
  getRoomReviews,
} = require('../controllers/reviewController');

// GET – pending reviews for the current user
router.get('/pending', protect, getPendingReviews);

// POST – submit a review (matches frontend `createReview` call)
router.post('/', protect, submitReview);

// GET – all reviews for a room
router.get('/room/:roomId', protect, getRoomReviews);

module.exports = router;