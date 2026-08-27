const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getRoomReviews, getPendingReviews, submitReview } = require('../controllers/reviewController');

router.get('/room/:roomId', protect, getRoomReviews);
router.get('/pending', protect, getPendingReviews);
router.post('/', protect, submitReview);

module.exports = router;